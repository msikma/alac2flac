// alac2flac <https://github.com/msikma/alac2flac>
// © MIT license

import fs from 'fs/promises'
import path from 'path'
import fg from 'fast-glob'
import {findM4aWinampRating} from './lib/m4a.js'
import {exec, execToJSON} from './lib/exec.js'

async function containsAlacStream(filepath) {
  const res = await execToJSON([`ffprobe`, `-v`, `quiet`, `-print_format`, `json`, `-show_streams`, `-show_format`, filepath])
  if (res === null) {
    return null
  }
  const alacStreams = res.streams.find(stream => stream.codec_name === 'alac')
  return !!alacStreams
}

async function getRateTag(filepath) {
  const data = await findM4aWinampRating(filepath)
  return data?.value
}

function getConversionCmd(filepath, ratingValue) {
  const parsed = path.parse(filepath)
  const outpath = `${parsed.dir}/${parsed.name}.flac`
  const rating = ratingValue ? [`-metadata`, `RATING=${ratingValue}`] : []
  const cmd = [`ffmpeg`, `-y`, `-progress`, `-`, `-i`, filepath, `-c:a`, `flac`, `-c:v`, `copy`, ...rating, outpath]
  return [cmd, outpath]
}

async function runConversion(conversionCmd) {
  const res = await exec(conversionCmd)
  const out = res?.stdout?.toString()
  return res.code === 0 && out.includes('progress=end')
}

export async function runFromCli(args) {
  const state = {
    mustExit: false
  }

  // Attach a handler for CTRL+C so we can exit cleanly.
  process.on('SIGINT', function() {
    console.log('\nCTRL+C caught, will exit after cleanup...')
    state.mustExit = true
  })

  function checkExit() {
    if (state.mustExit) {
      console.log(`Exiting...`)
      process.exit(0)
    }
  }

  const files = await fg('**/*.m4a', {cwd: args.pathScan})
  for (const file of files) {
    const filepath = `${args.pathScan}/${file}`
    const isAlac = await containsAlacStream(filepath)
    if (!isAlac) {
      checkExit()
      continue
    }
    const ratingValue = await getRateTag(filepath)
    const [conversionCmd, outpath] = getConversionCmd(filepath, ratingValue)
    if (args.optDryRun) {
      console.log('f:', filepath)
      checkExit()
      continue
    }
    const res = await runConversion(conversionCmd)
    if (!res) {
      console.error('failed:', filepath, {rating: ratingValue})
      try {
        await fs.unlink(outpath)
      }
      catch (err) {
        if (err.code !== 'ENOENT') {
          console.error(`error: could not delete the failed file (${outpath}):`, err.message)
        }
      }
    }
    else {
      console.log(`converted:`, filepath, {rating: ratingValue})
      try {
        await fs.unlink(filepath)
      }
      catch (err) {
        console.error(`error: could not delete old file (${filepath}):`, err.message)
      }
    }
    checkExit()
  }
}
