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
  await listArchive(archivePath).progress(files => {
    const filenames = files.map(file => file.name)
    allFilesInArchives.push(...filenames)
  })
}
console.dir(allFilesInArchives, { maxArrayLength: null }) //print all to console
