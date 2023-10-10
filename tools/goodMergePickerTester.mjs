/**
 * run with:  npx tsx ./tools/goodMergePickerTester.mjs
 * or npx tsx ./tools/goodMergePickerTester.mjs | grep "Picked Rom"
 */
import { basename } from 'path'
import fs from 'fs/promises'
import { listArchive } from 'node-7z-archive'
//only treating as default export works, and only with tsx
import * as goodMergeChooser from '../app/utils/goodMergeChooser.ts'
const { chooseGoodMergeRom, sortGoodMergeRoms } = goodMergeChooser.default
const romdata = JSON.parse(await fs.readFile('outputs/romdata.json'))

const archivePaths = romdata.romdata.map(row => row.path)

const gamePathMacOS = gamePath => {
  const transformedPath = gamePath
    .replace(/^[A-Za-z]:/, '')
    .split('\\')
    .join('/')
  return '/Volumes/Untitled/Games' + transformedPath
}
const archivePathsMacOS = archivePaths.map(gamePathMacOS)

for (const archivePath of archivePathsMacOS) {
  await listArchive(archivePath)
    .progress(async files => {
      const filenames = files.map(file => file.name)
      console.log('\x1b[33m%s\x1b[0m', `Archive: ${archivePath}`)
      // console.log('\x1b[33m%s\x1b[0m', `Archive: ${basename(archivePath)}`)
      console.log('Roms in 7z:', filenames)
      const allCodes = filenames.map(parseCodes)
      console.log('Parsed Codes:')
      console.dir(allCodes, { maxArrayLength: null })

      const countryCodes = new Map([ ['PD', 1], ['Unl', 2], ['Unk', 3], ['B', 4], ['A', 5], ['4', 6], ['U', 7], ['W', 8], ['E', 9], ['UK', 10] ]) // prettier-ignore
      const priorityCodes = new Map([ ['h', 1], ['p', 2], ['a', 3], ['f', 4], ['!', 5] ]) // prettier-ignore
      const disableTheLogger = { log: () => {} }
      const sortedRoms = sortGoodMergeRoms(filenames, countryCodes, priorityCodes, disableTheLogger)
      const pickedRom = sortedRoms[0]
      console.log(`Sorted array`, sortedRoms)
      //console.log(`So picked Rom for ${archivePath}`, pickedRom)
      console.log(
        '\x1b[33m%s\x1b[0m',
        `Archive: ${basename(archivePath)}` +
          ' '.repeat(Math.max(0, 80 - basename(archivePath).length)) +
          `Picked Rom: ${pickedRom}`
      )
      console.log(
        `----------------------------------------------------------------------------------------------------------------------------------------------------------`
      )
    })
    .catch(err => console.err(`Error listing archive ${archivePath}: `, err))
}

//but let's also try and extract the unique portions to see what we can learn
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
