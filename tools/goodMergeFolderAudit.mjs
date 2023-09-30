import fs from 'fs/promises'
import { listArchive } from 'node-7z-archive'
const romdata = JSON.parse(await fs.readFile('outputs/romdata.json'))

/**
 * The GoodMerge Coding is a loose convention (see standard and special codes listsed in goodMergeChooser.tsx)
 * To work out rules for auto-choosing the best rom, we need to see what files are in the archives, and what
 * the codes are. We need to do this for every goodmerge set really....
 */
const archivePaths = romdata.romdata.map(row => row.path)

//my romdata has windows paths, will become a common problem
const gamePathMacOS = gamePath => {
  const transformedPath = gamePath
    .replace(/^[A-Za-z]:/, '')
    .split('\\')
    .join('/')
  return '/Volumes/Untitled/Games' + transformedPath
}
const archivePathsMacOS = archivePaths.map(gamePathMacOS)
const allFilesInArchives = []
for (const archivePath of archivePathsMacOS) {
  await listArchive(archivePath)
    .progress(files => {
      const filenames = files.map(file => file.name)
      allFilesInArchives.push(...filenames)
    })
    .catch(err => console.err(`error listing archive ${archivePath}: `, err))
}
//console.dir(allFilesInArchives, { maxArrayLength: null }) //all filenames array

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
const allCodesInArchive = allFilesInArchives.map(parseCodes)
console.dir(allCodesInArchive, { maxArrayLength: null }) //print all to console, pipe output to file if you want
