import * as fs from 'fs'
import * as path from 'path'
import * as ini from 'ini'
import { convertRomDataToJSON, saveToJSONFile } from './romdataToJSON'
import { type BackupChoice, handleExistingData, handleExistingFiles } from './safeDirectoryOps.server'
import { convertSystems, convertEmulators, convertMediaPanel } from './datConverters.server'
import { logger } from '~/dataLocations.server'

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
  // We need to track if this directory has GoodMergeCompat=1
  let isGoodMerge = false

  // Only log directory processing at the higher levels to avoid excessive logging
  const isTopLevel = !source.includes(path.sep + 'data' + path.sep)
  if (isTopLevel) {
    logger.log('romdataConvert', `Processing directory: ${source}`)
  }

  // First process the folders.ini to see if we have a GoodMerge collection
  const foldersIniPath = path.join(source, 'folders.ini')
  if (fs.existsSync(foldersIniPath)) {
    try {
      const iniData = ini.parse(fs.readFileSync(foldersIniPath, 'utf-8'))
      isGoodMerge = iniData['GoodMerge'] && iniData['GoodMerge']['GoodMergeCompat'] === '1'

      if (isGoodMerge && isTopLevel) {
        logger.log('romdataConvert', `Found GoodMerge collection in: ${source}`)
      }

      const folderInfo = {
        versionInfo: {
          'Folder Info JSON Version': '1.0'
        },
        folderInfo: {
          iconLink: iniData['Icon'] && iniData['Icon']['CmbIcon'] ? iniData['Icon']['CmbIcon'] : ''
        }
      }
      const folderInfoPath = path.join(destination, 'folderInfo.json')
      saveToJSONFile(folderInfo, folderInfoPath)
      convertedFiles++
    } catch (err) {
      logger.log('romdataConvert', `Failed to process folders.ini at ${foldersIniPath}: ${err.message}`)
    }
  }

  // Now process everything else, passing the isGoodMerge flag when processing romdata.dat
  for (const item of items) {
    if (item === 'folders.ini') continue // Skip, we've already processed it

    const sourcePath = path.join(source, item)
    const destPath = path.join(destination, item)

    if (fs.lstatSync(sourcePath).isDirectory()) {
      try {
        fs.mkdirSync(destPath, { recursive: true })
        const filesConverted = processRomdataDirectory(sourcePath, destPath)
        convertedFiles += filesConverted

        // Log summary for significant directories
        if (filesConverted > 0 && isTopLevel) {
          logger.log('romdataConvert', `Converted ${filesConverted} files in ${sourcePath}`)
        }
      } catch (err) {
        logger.log('romdataConvert', `Failed to process directory ${sourcePath}: ${err.message}`)
      }
    } else if (item.toLowerCase() === 'romdata.dat') {
      try {
        const romdataJson = convertRomDataToJSON(sourcePath, gamesDirPathPrefix, isGoodMerge)
        if (romdataJson !== null) {
          // Only log if it's a significant romdata file (containing many entries) or has issues
          if (romdataJson.romdata && romdataJson.romdata.length > 100) {
            logger.log(
              'romdataConvert',
              `Converting large romdata: ${sourcePath} (${romdataJson.romdata.length} entries${
                isGoodMerge ? ', GoodMerge type' : ''
              })`
            )
          }
          // Use case-insensitive regex to replace .dat or .DAT with .json
          saveToJSONFile(romdataJson, destPath.replace(/\.dat$/i, '.json').toLowerCase())
          convertedFiles++
        } else {
          logger.log('romdataConvert', `Empty romdata at ${sourcePath}. No file created.`)
        }
      } catch (err) {
        logger.log('romdataConvert', `Failed to convert romdata at ${sourcePath}: ${err.message}`)
      }
    }
  }

  return convertedFiles
}

export async function convertQuickPlayData(
  sourcePath: string,
  options: ConversionOptions,
  dataDirectory: string,
  datsDirectory: string,
  backupChoice?: BackupChoice,
  outputDir: string = '.' // Default to current directory (its for cli tool only)
): Promise<ConversionResult> {
  logger.log('romdataConvert', `Starting QuickPlay data conversion from ${sourcePath}`);
  logger.log('romdataConvert', `Options: ${JSON.stringify(options)}`);
  
  try {
    const { dataFolderPath, datsFolderPath } = await validateQuickPlayDirectory(sourcePath)
    logger.log('romdataConvert', `Validated QuickPlay directory structure at ${sourcePath}`);

    // Setup input paths
    const inputDataDirFull = dataFolderPath
    const inputDatsSystems = path.join(datsFolderPath, 'systems.dat')
    const inputDatsEmulators = path.join(datsFolderPath, 'emulators.ini')
    const inputDatsMediaPanelConfig = path.join(datsFolderPath, 'mediaPanelCfg.ini')

    // Setup output paths
    const outputDataDir = dataDirectory
    const outputDatsDir = datsDirectory
    const outputDatsSystems = path.join(outputDatsDir, 'systems.json')
    const outputDatsEmulators = path.join(outputDatsDir, 'emulators.json')
    const outputDatsMediaPanelConfig = path.join(outputDatsDir, 'mediaPanelConfig.json')
    const outputDatsMediaPanelSettings = path.join(outputDatsDir, 'mediaPanelSettings.json')

    // Create directories if they don't exist
    if (options.convertRomdata) {
      fs.mkdirSync(outputDataDir, { recursive: true })
      logger.log('romdataConvert', `Created output data directory: ${outputDataDir}`);
    }
    
    if (options.convertSystems || options.convertEmulators || options.convertMediaPanel) {
      fs.mkdirSync(outputDatsDir, { recursive: true })
      logger.log('romdataConvert', `Created output dats directory: ${outputDatsDir}`);
    }

    // Handle existing dat files if backup choice is provided
    if (backupChoice) {
      const filesToHandle = []
      if (options.convertSystems && fs.existsSync(outputDatsSystems)) filesToHandle.push(outputDatsSystems)
      if (options.convertEmulators && fs.existsSync(outputDatsEmulators)) filesToHandle.push(outputDatsEmulators)
      if (options.convertMediaPanel) {
        if (fs.existsSync(outputDatsMediaPanelConfig)) filesToHandle.push(outputDatsMediaPanelConfig)
        if (fs.existsSync(outputDatsMediaPanelSettings)) filesToHandle.push(outputDatsMediaPanelSettings)
      }
      
      if (filesToHandle.length > 0) {
        logger.log('romdataConvert', `Handling ${filesToHandle.length} existing dat files with choice: ${backupChoice}`);
      }
      
      if (options.convertRomdata && fs.existsSync(outputDataDir)) {
        logger.log('romdataConvert', `Handling existing data directory with choice: ${backupChoice}`);
        const dataResult = await handleExistingData(outputDataDir, backupChoice)
        if (!dataResult.success) {
          logger.log('romdataConvert', `Data directory backup operation cancelled or failed`);
          return { success: false, error: { component: 'backup', message: 'Backup cancelled' } }
        }
        logger.log('romdataConvert', `Successfully handled existing data directory`);
      }
      
      if (filesToHandle.length > 0) {
        const filesResult = await handleExistingFiles(filesToHandle, backupChoice)
        if (!filesResult.success) {
          logger.log('romdataConvert', `Dat files backup operation cancelled or failed`);
          return { success: false, error: { component: 'backup', message: 'Backup cancelled' } }
        }
        logger.log('romdataConvert', `Successfully handled existing dat files`);
      }
    }

    // Perform conversions
    const result: ConversionResult = { success: true }

    if (options.convertRomdata) {
      logger.log('romdataConvert', `Starting romdata conversion from ${inputDataDirFull} to ${outputDataDir}`);
      const startTime = Date.now();
      result.romdataFiles = processRomdataDirectory(inputDataDirFull, outputDataDir)
      const duration = (Date.now() - startTime) / 1000;
      logger.log('romdataConvert', `Romdata conversion complete: ${result.romdataFiles} files converted in ${duration.toFixed(2)}s`);
    }

    if (options.convertSystems) {
      logger.log('romdataConvert', `Converting systems.dat to JSON`);
      await convertSystems(inputDatsSystems, outputDatsSystems)
      result.systemsConverted = true
      logger.log('romdataConvert', `Systems conversion complete`);
    }

    if (options.convertEmulators) {
      logger.log('romdataConvert', `Converting emulators.ini to JSON`);
      await convertEmulators(inputDatsEmulators, outputDatsEmulators)
      result.emulatorsConverted = true
      logger.log('romdataConvert', `Emulators conversion complete`);
    }

    if (options.convertMediaPanel) {
      logger.log('romdataConvert', `Converting media panel configuration to JSON`);
      await convertMediaPanel(inputDatsMediaPanelConfig, outputDatsMediaPanelConfig)
      result.mediaPanelConverted = true
      logger.log('romdataConvert', `Media panel conversion complete`);
    }

    logger.log('romdataConvert', `QuickPlay data conversion completed successfully`);
    return result
  } catch (error) {
    logger.log('romdataConvert', `Conversion error: ${error.message}`);
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
  if (!fs.existsSync(dataFolderPath)) throw new Error('Selected folder must contain a "data" directory')
  if (!fs.existsSync(datsFolderPath)) throw new Error('Selected folder must contain a "dats" directory')

  return { dataFolderPath, datsFolderPath }
}
