import * as fs from 'fs'
import * as path from 'path'
import * as ini from 'ini'
import { convertRomDataToJSON, saveToJSONFile } from './romdataToJSON'
import { BackupChoice, handleExistingData, handleExistingFiles } from './safeDirectoryOps.server'
import { convertSystems, convertEmulators, convertMediaPanel } from './datConverters.server'

export type ConversionOptions = {
  convertRomdata?: boolean
  convertSystems?: boolean
  convertEmulators?: boolean
  convertMediaPanel?: boolean
}

export type ConversionResult = {
  success: boolean
  romdataFiles?: number
  systemsConverted?: boolean
  emulatorsConverted?: boolean
  mediaPanelConverted?: boolean
  error?: {
    component: string
    message: string
  }
}

// ROMDATA CONVERSION CODE

//To enable cross-platform use, replace any path prefixes with '{gamesDir}'
// we'll then set the appropriate gamesDrive prefix for the platform, this is optional
const gamesDirPathPrefix = 'F:'
/**
 * takes a directory of QuickPlay Frontend's data (preferably QuickPlay Frontend's data folder),
 * walks the folder tree, creating a mirror directory tree at dest, and converts all romdata.dat files to romdata.json at dest,
 * also converting minimum data from all folders.ini and writing to folderInfo.json at dest
 * Does not preserve empty keys
 */
function processRomdataDirectory(source: string, destination: string): number {
  const items = fs.readdirSync(source)
  let convertedFiles = 0

  for (const item of items) {
    const sourcePath = path.join(source, item)
    const destPath = path.join(destination, item)

    if (fs.lstatSync(sourcePath).isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true })
      convertedFiles += processRomdataDirectory(sourcePath, destPath)
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

export async function convertQuickPlayData(
  sourcePath: string,
  options: ConversionOptions,
  backupChoice?: BackupChoice,
  outputDir: string = '.' // Default to current directory (its for cli tool only)
): Promise<ConversionResult> {
  try {
    const { dataFolderPath, datsFolderPath } = await validateQuickPlayDirectory(sourcePath)

    // Create directories if they don't exist
    if (options.convertRomdata) {
      fs.mkdirSync(path.join(outputDir, 'data'), { recursive: true })
    }
    if (options.convertSystems || options.convertEmulators || options.convertMediaPanel) {
      fs.mkdirSync(path.join(outputDir, 'dats'), { recursive: true })
    }

    // Handle existing dat files if backup choice is provided
    // (consider with data its a tree and we backup the whole folder, named, with dats its individual files we backup TO the existing dats folder)
    if (backupChoice) {
      const filesToHandle = []
      if (options.convertSystems && fs.existsSync(path.join(outputDir, 'dats', 'systems.json'))) {
        filesToHandle.push(path.join(outputDir, 'dats', 'systems.json'))
      }
      if (options.convertEmulators && fs.existsSync(path.join(outputDir, 'dats', 'emulators.json'))) {
        filesToHandle.push(path.join(outputDir, 'dats', 'emulators.json'))
      }
      if (options.convertMediaPanel) {
        if (fs.existsSync(path.join(outputDir, 'dats', 'mediaPanelConfig.json'))) {
          filesToHandle.push(path.join(outputDir, 'dats', 'mediaPanelConfig.json'))
        }
        if (fs.existsSync(path.join(outputDir, 'dats', 'mediaPanelSettings.json'))) {
          filesToHandle.push(path.join(outputDir, 'dats', 'mediaPanelSettings.json'))
        }
      }
      if (options.convertRomdata && fs.existsSync(path.join(outputDir, 'data'))) {
        const dataResult = await handleExistingData(path.join(outputDir, 'data'), backupChoice)
        if (!dataResult.success) {
          return { success: false, error: { component: 'backup', message: 'Backup cancelled' } }
        }
      }
      if (filesToHandle.length > 0) {
        const filesResult = await handleExistingFiles(filesToHandle, backupChoice)
        if (!filesResult.success) {
          return { success: false, error: { component: 'backup', message: 'Backup cancelled' } }
        }
      }
    }

    // Perform conversions
    const result: ConversionResult = { success: true }

    // Perform conversions
    if (options.convertRomdata) {
      result.romdataFiles = processRomdataDirectory(dataFolderPath, path.join(outputDir, 'data'))
    }

    if (options.convertSystems) {
      result.systemsConverted = await convertSystems(
        path.join(datsFolderPath, 'systems.dat'),
        path.join(outputDir, 'dats', 'systems.json')
      )
    }

    if (options.convertEmulators) {
      result.emulatorsConverted = await convertEmulators(
        path.join(datsFolderPath, 'emulators.ini'),
        path.join(outputDir, 'dats', 'emulators.json')
      )
    }

    if (options.convertMediaPanel) {
      result.mediaPanelConverted = await convertMediaPanel(
        path.join(datsFolderPath, 'mediaPanelCfg.ini'),
        path.join(outputDir, 'dats', 'mediaPanelConfig.json')
      )
    }

    return result
  } catch (error) {
    return {
      success: false,
      error: {
        component: 'conversion',
        message: error.message
      }
    }
  }
}

export async function validateQuickPlayDirectory(
  sourcePath: string
): Promise<{ dataFolderPath: string; datsFolderPath: string }> {
  if (!fs.existsSync(sourcePath)) {
    throw new Error('Source path does not exist')
  }

  const dataFolderPath = path.join(sourcePath, 'data')
  const datsFolderPath = path.join(sourcePath, 'dats')

  if (!fs.existsSync(dataFolderPath)) {
    throw new Error('Selected folder must contain a "data" directory')
  }
  if (!fs.existsSync(datsFolderPath)) {
    throw new Error('Selected folder must contain a "dats" directory')
  }

  return { dataFolderPath, datsFolderPath }
}
