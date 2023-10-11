import { basename } from 'path'
import fs from 'fs/promises'
import { listArchive } from 'node-7z-archive'
//only treating as default export works, and only with ts
import * as goodMergeChooser from '../app/utils/goodMergeChooser.ts'
const { sortGoodMergeRoms } = goodMergeChooser.default

/**
 * run with:  npx tsx ./tools/goodMergePickerTester.mjs
 * or npx tsx ./tools/goodMergePickerTester.mjs | grep "Picked Rom"
 * pipe output to file if you want
 */
const orangeLog = (...str) => console.log('\x1b[33m%s\x1b[0m', ...str)
const blueLog = (...str) => console.log('\x1b[34m%s\x1b[0m', ...str)
blueLog(` 
( ͡° ͜ʖ ͡°) GoodMerge Picker Tester ( ͡° ͜ʖ ͡°
  --To examine how QuickPlay would process a set of roms given a set of GoodMerge Preferences--
* Reads a (peviously-converted) romdata.json
* Uses GoodMerge Region and Special code preferences (higher is more-preferred)
* Uses a root games path
* Uses 7z to list the contents of each archive
* Prints out the parsed codes for each rom in each archive
* Uses the goodMergeChooser logic in this repo to sort the roms in each archive
* Prints out the sorted array and the picked rom for each archive 
`)

const romdataFile = 'outputs/romdata.json'
orangeLog('Reading romdata file:', romdataFile)
const romdata = JSON.parse(await fs.readFile(romdataFile))
const countryCodes = new Map([ ['PD', 1], ['Unl', 2], ['Unk', 3], ['B', 4], ['A', 5], ['4', 6], ['U', 7], ['W', 8], ['E', 9], ['UK', 10] ]) // prettier-ignore
const priorityCodes = new Map([ ['h', 1], ['p', 2], ['a', 3], ['f', 4], ['!', 5] ]) // prettier-ignore
orangeLog('Using GoodMerge country Code Priorities:', countryCodes)
orangeLog('Using GoodMerge standard Codes Priorities:', priorityCodes)

//romdata has windows paths, but we need to operate on the real files
const macOsGamesPath = '/Volumes/Untitled/Games'
orangeLog('Using Games root path:', macOsGamesPath)
const archivePaths = romdata.romdata.map(row => row.path)
const gamePathMacOS = gamePath => {
  const transformedPath = gamePath
    .replace(/^[A-Za-z]:/, '')
    .split('\\')
    .join('/')
  return macOsGamesPath + transformedPath
}
const archivePathsMacOS = archivePaths.map(gamePathMacOS)
await new Promise(resolve => setTimeout(resolve, 10000)) //just so you can read the above

for (const archivePath of archivePathsMacOS) {
  await listArchive(archivePath)
    .progress(async files => {
      const filenames = files.map(file => file.name)
      blueLog(`Path: ${archivePath}`)
      console.log('Roms in 7z:', filenames)
      const allCodes = filenames.map(parseCodes)
      console.log('Parsed Codes:')
      console.dir(allCodes, { maxArrayLength: null })

      const disableTheLogger = { log: () => {} }
      const sortedRoms = sortGoodMergeRoms(filenames, countryCodes, priorityCodes, disableTheLogger)
      const pickedRom = sortedRoms[0]
      console.log(`Sorted array`, sortedRoms)
      orangeLog(
        `Archive: ${basename(archivePath)}` +
          ' '.repeat(Math.max(0, 60 - basename(archivePath).length)) +
          `Picked Rom: ${pickedRom}`
      )
      console.log(`-`.repeat(120))
    })
    .catch(err => console.error(`Error listing archive ${archivePath}: `, err))
}

/**
 * Prints Parsed Codes - why?
 * The GoodMerge Coding is a loose convention (see standard and special codes listsed in goodMergeChooser.tsx)
 * To work out rules for auto-choosing the best rom. We need to do this for every goodmerge set really (each set has specific considerations)
 */
function parseCodes(fileName) {
  const regex = /(?:\(([^)]+)\)|\[([^\]]+)\])/g //match either of the following: (parens) [brackets], capture contents of parens/brackets
  const matches = [...fileName.matchAll(regex)]
  const parensCodes = matches.map(match => match[1]).filter(Boolean)
  const bracketCodes = matches.map(match => match[2]).filter(Boolean)
  const padding = ' '.repeat(Math.max(0, 80 - fileName.length))
  const codePadding = ' '.repeat(Math.max(0, 40 - parensCodes.join(', ').length))

  return `${fileName}${padding}Codes:             (${parensCodes.join(', ')})${codePadding}${
    bracketCodes.length ? '[' + bracketCodes.join(', ') + ']' : ''
  }`
}
