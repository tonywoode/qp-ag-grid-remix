import { spawn } from 'child_process'
import type { ActionFunctionArgs } from '@remix-run/node'
import path from 'path'
import os from 'os'
import { chooseGoodMergeRom } from '~/utils/goodMergeChooser'
import { createDirIfNotExist } from '../utils/createDirIfNotExist'
import { logger } from '../root'
import { convertPathToOSPath } from '~/utils/OSConvert.server'
import { emitter } from '~/utils/emitter.server'
import { sevenZipFileExtensions } from '~/utils/fileExtensions'
import { loadNode7z } from '~/utils/node7zLoader.server'
import { emulators } from '~/root' // Import emulators from root

//ORDERED list of disk image filetypes we'll support extraction of (subtlety here is we must extract ALL the image files and find the RUNNABLE file)
const diskImageExtensions = ['.chd', '.nrg', '.mdf', '.img', '.ccd', '.cue', '.bin', '.iso']

//only one game can be run by me at a time - we don't want to use exec, we may want to be able to navigate qp for maps, walkthroughs, keybindings
let currentProcess = null
let currentGameDetails = null

//SSE: emit is sync - delay for two reasons: (1) events too close clobber each other (2) lack of await working sensibly for node-7z-archive operations
async function emitEvent({ type, data }: { type: string; data: string }) {
  await new Promise(resolve => setTimeout(resolve, 100))
  emitter.emit('runGameEvent', { type, data })
}

export async function action({ request }: ActionFunctionArgs) {
  const { gamePath, fileInZipToRun, emulatorName, clearProcess, mameName, parentName, parameters, paramMode } =
    await request.json()
  if (clearProcess) {
    currentProcess = null
    currentGameDetails = null
    return null
  }
  logger.log(`fileOperations`, `runGame received from grid`, {
    gamePath,
    fileInZipToRun,
    emulatorName,
    mameName,
    parentName,
    parameters,
    paramMode
  })
  await emitEvent({ type: 'QPBackend', data: 'Going to run ' + gamePath })
  //TODO: should be an .env variable with a ui to set (or something on romdata conversation?)
  const gamePathMacOS = convertPathToOSPath(gamePath)
  const outputDirectory = setTempDir()
  const gameExtension = path.extname(gamePathMacOS).toLowerCase()
  //archives could be both disk images or things like goodmerge sets. TODO: some emulators can run zipped roms directly
  const isZip = sevenZipFileExtensions.map(ext => ext.toLowerCase()).includes(gameExtension)

  if (isZip) {
    await emitEvent({ type: 'QPBackend', data: 'Zip detected passing to 7z ' + gamePathMacOS })
    await emitEvent({ type: 'status', data: 'isZip' }) // Add this line to emit zip status
    await examineZip(gamePathMacOS, outputDirectory, fileInZipToRun, emulatorName, mameName, parentName, parameters, paramMode)
  } else {
    await emitEvent({ type: 'QPBackend', data: 'Game File detected, directly running ' + gamePathMacOS })
    await runGame(gamePathMacOS, emulatorName, mameName, parentName, parameters, paramMode)
  }
  return null
}

async function examineZip(
  gamePathMacOS,
  outputDirectory,
  fileInZipToRun,
  emulatorName,
  mameName,
  parentName,
  parameters,
  paramMode
) {
  const { onlyArchive, listArchive, fullArchive } = await loadNode7z()

  if (fileInZipToRun) {
    await emitEvent({ type: 'zip', data: 'unzipping with a running file specified ' + fileInZipToRun })
    await extractSingleRom(gamePathMacOS, outputDirectory, fileInZipToRun, onlyArchive, logger)
    const outputFile = path.join(outputDirectory, fileInZipToRun)
    runGame(outputFile, emulatorName, mameName, parentName, parameters, paramMode)
  } else {
    logger.log(`fileOperations`, 'listing archive', gamePathMacOS)
    await emitEvent({ type: 'zip', data: 'listing archive to find runnable file ' + gamePathMacOS })
    try {
      const result = await new Promise((resolve, reject) => {
        listArchive(gamePathMacOS)
          .progress(async (files: { name: string }[]) => {
            if (files.length > 0) {
              await emitEvent({
                type: 'zip',
                data: 'listed archive:\n' + files.map(file => `\t${file.name}`).join('\n')
              })
              // emitter.emit('runGameEvent', { type: 'status', data: 'zip-success' }) // don't add success status if all we've done is list
              const matchedEmulator = matchEmulatorName(emulatorName, emulators)
              //temporary fix: it isn't QUITE good enough to say a rom is mame if we call ROMMAME, otherGameNames etc...so also this:
              const isMameEmulator =
                matchedEmulator?.emulatorName.startsWith('MAME') || matchedEmulator?.emulatorName.endsWith('(MAME)')
              const find = (str, start, end) => str?.match(new RegExp(`${start}(.*?)${end}`))[1]
              const namedOutputType = find(matchedEmulator?.parameters, '%', '%')
              const isMameRom = namedOutputType === 'ROMMAME'

              if (isMameEmulator || isMameRom) {
                await emitEvent({ type: 'QPBackend', data: 'MAME game detected, running directly' })
                await runGame(gamePathMacOS, emulatorName, mameName, parentName, parameters, paramMode)
                return files
              } else {
                const pickedRom = await handleDiskImages(files, gamePathMacOS, outputDirectory, fullArchive)
                if (pickedRom) {
                  const outputFile = path.join(outputDirectory, pickedRom)
                  await emitEvent({
                    type: 'QPBackend',
                    data: 'running runnable iso file' + outputFile
                  }) //prettier-ignore
                  await runGame(outputFile, emulatorName, mameName, parentName, parameters, paramMode)
                  return files
                } else {
                  const pickedRom = await handleNonDiskImages(files, gamePathMacOS, outputDirectory, onlyArchive)
                  const outputFile = path.join(outputDirectory, pickedRom)
                  await runGame(outputFile, emulatorName, mameName, parentName, parameters, paramMode)
                  return files
                }
              }
            }
            //else reject the promise
            reject('no files found in archive')
          })
          .then(archivePathsSpec => {
            if (archivePathsSpec) {
              logger.log(`fileOperations`, `listed this archive: `, archivePathsSpec)
              resolve(archivePathsSpec) //TODO: now we can populate the output
            }
          })
          .catch(err => {
            console.error('error listing archive: ', err)
            emitter.emit('runGameEvent', { type: 'status', data: 'zip-error ' + err }) // Add error status
            reject(err)
          })
      })
      return result // Only continue if listArchive succeeds
      //TODO: valid? async Log error and return early, stopping the flow
    } catch (error) {
      logger.log('fileOperationss', 'Failed to process archive:', error)
      return null
    }
  }
}

//first look for ANY of the files from the image list, if any are found, treat it as an image, THEN look in order for runnable files, extract all and then pass RUNNABLE file to emu
async function handleDiskImages(files, gamePathMacOS, outputDirectory, fullArchive) {
  logger.log('fileOperations', `checking for disk images in files`, files)
  const diskImageFiles = files.filter(file => diskImageExtensions.includes(path.extname(file.name)))
  if (diskImageFiles.length > 0) {
    logger.log(`fileOperations`, `found disk image files in archive`, diskImageFiles)
    await emitEvent({ type: 'QPBackend', data: 'found disk image file to run (extracting full archive)' })
    await extractFullArchive(gamePathMacOS, outputDirectory, fullArchive, logger)
    const pickedRom = diskImageExtensions
      .map(ext => diskImageFiles.find(file => path.extname(file.name) === ext))
      .find(file => file)?.name // pick the first matching file based on the order of diskImageExtensions
    return pickedRom
  }
  return null
}

async function handleNonDiskImages(files, gamePathMacOS, outputDirectory, onlyArchive) {
  //if its not a disk image, we can just pick the best runnable file to pass to the emu
  const filenames = files.map(file => file.name)
  logger.log(`fileOperations`, `7z listing: `, filenames)
  const pickedRom = setupChooseGoodMergeRom(filenames, logger)
  logger.log(`goodMergeChoosing`, `computer picked this rom:`, pickedRom)
  await emitEvent({ type: 'QPBackend', data: 'Goodmerge choosing chose this one for you: ' + pickedRom })
  await extractSingleRom(gamePathMacOS, outputDirectory, pickedRom, onlyArchive, logger)
  return pickedRom
}

function setupChooseGoodMergeRom(filenames: string[], logger) {
  const fallbackCountryCodes = new Map([
    // would rather get these than wrong language TODO: think the fallback codes are Genesis-specific?
    ['PD', 1],
    ['Unl', 2],
    ['Unk', 3]
  ])
  const countryCodePrefs = new Map([
    ['B', 4],
    ['A', 5],
    ['4', 6],
    ['U', 7],
    ['W', 8], //world actually prob means there's only one country code in the rom?
    ['E', 9],
    ['UK', 10] //highest priority
  ])
  const countryCodes = new Map([...fallbackCountryCodes, ...countryCodePrefs])
  const priorityCodes = new Map([
    ['h', 1],
    ['p', 2],
    ['a', 3],
    ['f', 4],
    ['!', 5] //highest priority
  ])
  logger.log(
    `goodMergeChoosing`,
    `sending goodMerge country and priority choices to GoodMerge chooser`,
    countryCodes,
    priorityCodes
  )
  return chooseGoodMergeRom(filenames, countryCodes, priorityCodes, logger)
}

async function extractSingleRom(gamePath, outputDirectory, romInArchive, onlyArchive, logger) {
  await emitEvent({ type: 'zip', data: 'Starting extraction...' })
  // Wrap old-style promise in async/await
  const result = await new Promise((resolve, reject) => {
    onlyArchive(gamePath, outputDirectory, romInArchive)
      .then(result => {
        logger.log(`fileOperations`, `extracting single file with 7z:`, result)
        resolve(result)
      })
      .catch(err => {
        console.error(err)
        emitter.emit('runGameEvent', { type: 'status', data: 'zip-error ' + err })
        reject(err)
      })
  })
  // Now we can safely emit after archive completes
  await emitEvent({ type: 'zip', data: 'Extraction complete: ' + result })
  emitter.emit('runGameEvent', { type: 'status', data: 'zip-success' })
  return result
}

async function extractFullArchive(gamePath, outputDirectory, fullArchive, logger) {
  const result = await new Promise((resolve, reject) => {
    fullArchive(gamePath, outputDirectory)
      .then(result => {
        logger.log(`fileOperations`, `extracting all files with 7z:`, result)
        resolve(result)
      })
      .catch(err => {
        console.error(err)
        emitter.emit('runGameEvent', { type: 'status', data: 'zip-error ' + err })
        reject(err)
      })
  })
  await emitEvent({
    type: 'zip',
    data: 'Archive extraction complete: ' + result
  })
  emitter.emit('runGameEvent', { type: 'status', data: 'zip-success' })
  return result
}

async function runGame(
  outputFile: string,
  emulatorName: string,
  mameName?: string,
  parentName?: string,
  parameters?: string,
  paramMode?: string //well a stringified int
) {
  console.log('runGame received these args:', outputFile, emulatorName, mameName, parentName)
  if (currentProcess) {
    logger.log(`fileOperations`, 'An emulator is already running. Please close it before launching a new game.')
    await emitEvent({
      type: 'onlyOneEmu',
      data: `An emulator is already running: ${currentGameDetails.name} with ${currentGameDetails.emulatorName}. Please close it before launching a new game.`
    })
    return
  }

  const splitMultiloaderCMD = (command: string) => {
    const args = []
    const regex = /"([^"]*)"|(\S+)/g // Matches quoted strings or non-space sequences

    let match
    while ((match = regex.exec(command)) !== null) {
      args.push(match[1] || match[2]) // Use captured group for quoted or unquoted
    }
    return args
  }

  const matchedEmulator = matchEmulatorName(emulatorName, emulators)
  logger.log(`fileOperations`, 'Matched Emulator:', matchedEmulator)
  if (matchedEmulator) {
    let emuParams: string[] | null = null
    let emuPath: string

    if (process.platform !== 'win32') {
      //only tested on mac, mac is only capable of retroarch loading, and from default install locations
      const retroarchCommandLine = extractRetroarchCommandLine(matchedEmulator)
      logger.log(`fileOperations`, 'Retroarch Command Line On Mac:', retroarchCommandLine)
      const retroarchExe = '/Applications/Retroarch.app/Contents/MacOS/RetroArch'
      //get the retroarch core dir
      const homeDir = os.homedir()
      const retroarchDir = path.join(homeDir, 'Library', 'Application Support', 'RetroArch')
      const libretroCore = path.join(retroarchDir, retroarchCommandLine)
      // const libretroCore = `/Users/twoode/Library/Application Support/RetroArch/${retroarchCommandLine}`
      const flagsToEmu = '-v -f'
      emuParams = [outputFile, '-L', libretroCore, ...flagsToEmu.split(' ')]
      emuPath = retroarchExe
      // currentProcess = spawn(retroarchExe, [outputFile, '-L', libretroCore, ...flagsToEmu.split(' ')])
    } else {
      //platform is windows
      //takes matchedEmultor.parameters, finds the word inside the two %% and returns the word
      const find = (str, start, end) => str.match(new RegExp(`${start}(.*?)${end}`))[1]
      const namedOutputType = find(matchedEmulator.parameters, '%', '%')
      let emuParamsStr = matchedEmulator.parameters
      //if we have 'parameters' in the romdata line, incorporate it as specifed
      if (parameters) {
        /*
        //TROMParametersModeStr
        0 = QP_ROM_PARAM_AFTER = 'After Emulators';
        1 = QP_ROM_PARAM_OVERWRITE = 'Overwrite Emulators';
        2 = QP_ROM_PARAM_BEFORE = 'Before Emulators';
        3 = QP_ROM_PARAM_AFTER_NOSPACE = 'After Emulators with no space';
        4 = QP_ROM_PARAM_BEFORE_NOSPACE = 'Before Emulators with no space';
        */
        const paramModeInt = paramMode ? parseInt(paramMode) : NaN
        if (paramModeInt == 0) {
          emuParamsStr = `${emuParamsStr} ${parameters}`
        }
        if (paramModeInt == 1) {
          emuParamsStr = parameters
        }
        if (paramModeInt == 2) {
          emuParamsStr = `${parameters} ${emuParamsStr}`
        }
        if (paramModeInt == 3) {
          emuParamsStr = `${emuParamsStr}${parameters}`
        }
        if (paramModeInt == 4) {
          emuParamsStr = `${parameters}${emuParamsStr}`
        }
      }
      //split the string to process
      emuParams = emuParamsStr.split(' ')
      // Find the parameter containing our placeholder
      const placeholderParam = emuParams.find(param => param.includes(`%${namedOutputType}%`))
      console.log(emuParams)

      // Check for %tool:MULTILOADER% before other namedOutputType checks
      if (matchedEmulator.parameters.includes('%Tool:MULTILOADER%')) {
        let emulatorFlags: string[] = []
        const multiloaderRealFlagIndex = 3 // Always use the fourth parameter in MULTILOADER case
        const multiloaderParams = splitMultiloaderCMD(matchedEmulator.parameters)
        console.log('multiloader params', multiloaderParams)
        emulatorFlags = multiloaderParams[multiloaderRealFlagIndex]
        console.log('emulator flags', emulatorFlags)
        const emulatorFlagsArray = emulatorFlags.split(' ')
        emuParams = [outputFile, ...emulatorFlagsArray] // Rom path followed by emulator flags
        emuPath = matchedEmulator.path

        logger.log(`fileOperations`, 'Running emulator with MULTILOADER tool:', emuPath, emuParams)
      } else if (placeholderParam) {
        let paramIndex = emuParams.indexOf(placeholderParam)
        if (namedOutputType === 'ROM') {
          emuParams[paramIndex] = placeholderParam.replace(/%ROM%/g, outputFile)
        } else if (namedOutputType === 'SHORTROM') {
          //lets forget this old max-filename 8:3 naming thing
          emuParams[paramIndex] = placeholderParam.replace(/%SHORTROM%/g, outputFile)
        } else if (namedOutputType === 'ROMFILENAME') {
          emuParams[paramIndex] = placeholderParam.replace(/%ROMFILENAME%/g, path.basename(outputFile))
        } else if (namedOutputType === 'ROMFILENAMENOEXT') {
          emuParams[paramIndex] = placeholderParam.replace(
            /%ROMFILENAMENOEXT%/g,
            path.basename(outputFile).replace(/\.[^/.]+$/, '')
          )
        } else if (namedOutputType === 'ROMMAME') {
          //pass in the mamefilenames and run the child or if not available the parent
          if (mameName) {
            emuParams[paramIndex] = placeholderParam.replace(/%ROMMAME%/g, mameName)
          } else if (parentName) {
            emuParams[paramIndex] = placeholderParam.replace(/%ROMMAME%/g, parentName)
          } else {
            console.warn('No mameName or parentName available')
            emuParams = null // or handle the case where neither is available
          }
        }

        // After replacement, remove the outer quotes from the parameter - TODO: why? investigate emulators.json
        if (emuParams && emuParams[paramIndex]) {
          emuParams[paramIndex] = emuParams[paramIndex].replace(/^"(.*)"$/, '$1')
        }
      }

      emuPath = matchedEmulator.path
    }
    logger.log(`fileOperations`, 'Running emulator:', emuPath, emuParams)
    currentProcess = spawn(emuPath, emuParams, {
      cwd: path.dirname(emuPath) // Set working directory to emulator's directory
    })
    currentGameDetails = { name: outputFile, emulatorName }
    // Emit status when game starts - TODO: on success only
    await emitEvent({ type: 'status', data: 'running' })

    //Changing these SSE emits to the async fn seems a bad idea, we start racing again....
    //TODO: with retroarch, this ever gets run
    currentProcess.stdout.on('data', data => {
      logger.log(`fileOperations`, `Output: ${data}`)
      emitter.emit('runGameEvent', { type: 'EmuLog', data: data.toString() })
    })

    currentProcess.stderr.on('data', data => {
      logger.log(`fileOperations`, `Error: ${data}`)
      emitter.emit('runGameEvent', { type: 'EmuErrLog', data: data.toString() })
    })

    currentProcess.on('close', code => {
      logger.log(`fileOperations`, `Process exited with code ${code}`)
      //TODO: this won't get printed, but we can't make the fn async - try it we enter a whole new world of stdout race conditions
      emitter.emit('someOtherEvent', { type: 'close', data: `Process exited with code ${code}` })
      // Emit status when game ends
      emitter.emit('runGameEvent', { type: 'status', data: 'closed' })
      currentProcess = null
      currentGameDetails = null
    })
  } else {
    logger.log(`fileOperations`, 'Emulator not found')
  }
}

function matchEmulatorName(emulatorName, emulators) {
  return emulators.find(emulator => emulator.emulatorName === emulatorName)
}

function extractRetroarchCommandLine(emulatorJson) {
  const { parameters } = emulatorJson
  const libretroCoreMatch = parameters.match(/cores[^ ]+/)

  if (libretroCoreMatch) {
    logger.log(`fileOperations`, 'libretroCoreMatch', libretroCoreMatch)
    const libretroCorePath = libretroCoreMatch[0].replace(/\\/g, '/').replace(/"/g, '') //TODO: try loading a GC game without the " removal!
    logger.log(`fileOperations`, 'libretroCorePath', libretroCorePath)
    return libretroCorePath.replace(/\.dll$/, '.dylib')
  } else {
    return 'No libretro core found in parameters string' //TODO: don't return a string as an error
  }
}

//TODO: firstly a better way to determine app root! secondly a better process: consider that we MAY want to keep extracts hanging around for a few loads
// e.g.: for the sitation where you multiply load the same game, we can check if its already extracted. This is what 'tmp' was designed for, ideally a fixed size for the cache if not date dependent
function setTempDir() {
  const tempDir = path.join(process.cwd(), 'temp')
  createDirIfNotExist(tempDir)
  return tempDir
}
