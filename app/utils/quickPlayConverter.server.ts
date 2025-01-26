import * as fs from 'fs'
import * as path from 'path'
import * as ini from 'ini'
import { convertRomDataToJSON, saveToJSONFile } from './romdataToJSON'
import { BackupChoice, handleExistingData } from './safeDirectoryOps.server'
import { convertSystems, convertEmulators, convertMediaPanel } from './datConverters.server'

// copy the types and interfaces from the previous implementation
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

// move the existing romdata conversion code
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
      const romdataJson = convertRomDataToJSON(sourcePath, 'F:') // Use the gamesDirPathPrefix
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
  options: ConversionOptions = {
    convertRomdata: true,
    convertSystems: true,
    convertEmulators: true,
    convertMediaPanel: true
  },
  choice?: BackupChoice
): Promise<ConversionResult> {
  console.log('Starting conversion with:', { sourcePath, options, choice })

  try {
    const { dataFolderPath, datsFolderPath } = await validateQuickPlayDirectory(sourcePath)
    console.log('Validated directories:', { dataFolderPath, datsFolderPath })

    // Check for existing data first
    if (options.convertRomdata && fs.existsSync('data') && fs.readdirSync('data').length > 0) {
      console.log('Found existing data directory')
      if (!choice) throw new Error('EXISTING_DATA')
    }

    if (
      (options.convertSystems || options.convertEmulators || options.convertMediaPanel) &&
      fs.existsSync('dats') &&
      fs.readdirSync('dats').length > 0
    ) {
      console.log('Found existing dats directory')
      if (!choice) throw new Error('EXISTING_DATS')
    }

    // Handle existing directories if we have a choice
    if (choice) {
      console.log('Processing with choice:', choice)
      if (options.convertRomdata && fs.existsSync('data')) {
        const dataResult = await handleExistingData('data', choice)
        if (!dataResult.success) return { success: false }
      }

      if ((options.convertSystems || options.convertEmulators || options.convertMediaPanel) && fs.existsSync('dats')) {
        const datsResult = await handleExistingData('dats', choice)
        if (!datsResult.success) return { success: false }
      }
    }

    // Create directories
    if (options.convertRomdata) fs.mkdirSync('data', { recursive: true })
    if (options.convertSystems || options.convertEmulators || options.convertMediaPanel) {
      fs.mkdirSync('dats', { recursive: true })
    }

    const result: ConversionResult = { success: true }

    // Perform conversions
    try {
      // Convert each component
      if (options.convertRomdata) {
        console.log('Converting ROM data...')
        result.romdataFiles = processRomdataDirectory(dataFolderPath, 'data')
        console.log(`Converted ${result.romdataFiles} ROM data files`)
      }

      if (options.convertSystems) {
        console.log('Converting systems data...')
        result.systemsConverted = await convertSystems(
          path.join(datsFolderPath, 'systems.dat'),
          path.join('dats', 'systems.json')
        )
      }

      if (options.convertEmulators) {
        console.log('Converting emulators data...')
        result.emulatorsConverted = await convertEmulators(
          path.join(datsFolderPath, 'emulators.ini'),
          path.join('dats', 'emulators.json')
        )
      }

      if (options.convertMediaPanel) {
        console.log('Converting media panel configuration...')
        result.mediaPanelConverted = await convertMediaPanel(
          path.join(datsFolderPath, 'mediaPanelCfg.ini'),
          path.join('dats', 'mediaPanelConfig.json')
        )
      }

      console.log('Conversion completed successfully:', result)
      return result
    } catch (error) {
      console.error('Error during conversion:', error)
      throw error
    }
  } catch (error) {
    console.error('Conversion error:', error)
    return {
      success: false,
      error: {
        component: 'general',
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
