//run with npx tsx ./tools/mirrorAndConvertQPData.mjs

import { convertRomDataToJSON, saveToJSONFile } from '../app/utils/romdataToJSON'
import * as fs from 'fs'
import * as path from 'path'
import * as ini from 'ini'

//To enable cross-platform use, replace any path prefixes with '{gamesDir}'
// we'll then set the appropriate gamesDrive prefix for the platform, this is optional
const gamesDirPathPrefix = 'F:'

/**
 * takes a directory of QuickPlay Frontend's data (preferably QuickPlay Frontend's data folder),
 * walks the folder tree, creating a mirror directory tree at dest, and converts all romdata.dat files to romdata.json at dest,
 * also converting minimum data from all folders.ini and writing to folderInfo.json at dest
 * Does not preserve empty keys
 */
function processDirectory(source, destination) {
  const items = fs.readdirSync(source)

  for (const item of items) {
    const sourcePath = path.join(source, item)
    const destPath = path.join(destination, item)

    if (fs.lstatSync(sourcePath).isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true })
      processDirectory(sourcePath, destPath)
    } else if (item === 'folders.ini') {
      const iniData = ini.parse(fs.readFileSync(sourcePath, 'utf-8'))
      const cmbIcon = iniData['Icon']['CmbIcon']
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
    } else if (item.toLowerCase() === 'romdata.dat') {
      const romdataJson = convertRomDataToJSON(sourcePath, gamesDirPathPrefix)
      if (romdataJson !== null) {
        // Check if actual ROM data was found
        console.log(`Conversion complete. Output being saved to ${destPath.replace('.dat', '.json')}`)
        saveToJSONFile(romdataJson, destPath.replace('.dat', '.json').toLowerCase())
      } else {
        console.log(`No ROM data found in ${sourcePath}. Skipping file creation.`)
      }
    }
  }
}

// Usage
const sourceFolder = '/Volumes/Untitled/Emulators/QUICKPLAY/QuickPlayFrontend/qp/data'
const outputFolder = 'data'

fs.mkdirSync(outputFolder, { recursive: true })
processDirectory(sourceFolder, outputFolder)
