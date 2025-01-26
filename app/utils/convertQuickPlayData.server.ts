import * as fs from 'fs'
import * as path from 'path'
import * as ini from 'ini'
import { convertRomDataToJSON, saveToJSONFile } from './romdataToJSON'
import { BackupChoice, handleExistingData } from './safeDirectoryOps.server'

//To enable cross-platform use, replace any path prefixes with '{gamesDir}'
// we'll then set the appropriate gamesDrive prefix for the platform, this is optional
const gamesDirPathPrefix = 'F:'

export async function convertQuickPlayData(sourcePath: string, destinationPath: string = 'data', choice?: BackupChoice) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error('Source path does not exist')
  }

  const dataFolderPath = path.join(sourcePath, 'data')
  if (!fs.existsSync(dataFolderPath)) {
    throw new Error('No QuickPlay data folder found in selected directory')
  }

  if (fs.existsSync(destinationPath) && fs.readdirSync(destinationPath).length > 0) {
    if (!choice) {
      throw new Error('EXISTING_DATA')
    }
    const result = await handleExistingData(destinationPath, choice)
    if (!result.success) return null
  }

  fs.mkdirSync(destinationPath, { recursive: true })
  return processDirectory(dataFolderPath, destinationPath)
}
/**
 * takes a directory of QuickPlay Frontend's data (preferably QuickPlay Frontend's data folder),
 * walks the folder tree, creating a mirror directory tree at dest, and converts all romdata.dat files to romdata.json at dest,
 * also converting minimum data from all folders.ini and writing to folderInfo.json at dest
 * Does not preserve empty keys
 */
function processDirectory(source: string, destination: string): number {
  const items = fs.readdirSync(source)
  let convertedFiles = 0

  for (const item of items) {
    const sourcePath = path.join(source, item)
    const destPath = path.join(destination, item)

    if (fs.lstatSync(sourcePath).isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true })
      convertedFiles += processDirectory(sourcePath, destPath)
    } else if (item === 'folders.ini') {
      const iniData = ini.parse(fs.readFileSync(sourcePath, 'utf-8'))
      const folderInfo = {
        versionInfo: {
          'Folder Info JSON Version': '1.0'
        },
        folderInfo: {
          iconLink: iniData['Icon']['CmbIcon']
        }
      }
      const folderInfoPath = path.join(destination, 'folderInfo.json')
      saveToJSONFile(folderInfo, folderInfoPath)
      convertedFiles++
    } else if (item.toLowerCase() === 'romdata.dat') {
      const romdataJson = convertRomDataToJSON(sourcePath, gamesDirPathPrefix)
      if (romdataJson !== null) {
        console.log(`Converting: ${sourcePath} to ${destPath.replace('.dat', '.json')}`)
        saveToJSONFile(romdataJson, destPath.replace('.dat', '.json').toLowerCase())
        convertedFiles++
      } else {
        console.log(`No ROM data found in ${sourcePath}. Skipping file creation.`)
      }
    }
  }

  return convertedFiles
}
