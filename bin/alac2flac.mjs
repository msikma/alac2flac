#!/usr/bin/env node
// alac2flac <https://github.com/msikma/alac2flac>
// © MIT license

import os from 'os'
import fs from 'fs/promises'
import path from 'path'
import url from 'url'
import {ArgumentParser} from 'argparse'

async function main() {
  const pkgPath = path.join(url.fileURLToPath(new URL('.', import.meta.url)), '..', 'package.json')
  const pkgData = JSON.parse(await fs.readFile(pkgPath, 'utf8'))
  const parser = new ArgumentParser({
    add_help: true,
    description: `${pkgData.description}.`
  })

  parser.add_argument('-v', '--version', {action: 'version', version: `${pkgData.version}`})
  parser.add_argument('-d', '--dry-run', {action: 'store_true', dest: 'optDryRun'})
  parser.add_argument('-f', '--find', {dest: 'pathScan', help: 'Path to scan', metavar: 'PATH'})
  
  // Parse command line arguments; if something is wrong, the program exits here.
  const args = {
    ...parser.parse_args(),
    pathPackage: path.resolve(path.dirname(pkgPath)),
    packageData: pkgData
  }
  
  // Start the script.
  const {runFromCli} = await import('../index.js')
  runFromCli(args)
}

main()
