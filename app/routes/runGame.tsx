import { spawn } from 'child_process'
import type { ActionFunctionArgs } from '@remix-run/node'
import path from 'path'
import os from 'os'
import { chooseGoodMergeRom } from '~/utils/goodMergeChooser'
import { createDirIfNotExist } from '~/utils/safeDirectoryOps.server'
import { convertPathToOSPath } from '~/utils/OSConvert.server'
import { emitter } from '~/utils/emitter.server'
import { decodeCompressionSupport, sevenZipFileExtensions } from '~/utils/fileExtensions'
import { loadNode7z } from '~/utils/node7zLoader.server'
import { loadEmulators, getTempDirectory, logger } from '~/dataLocations.server'
import { getArchiveExtractionDir, verifyExtraction, touchExtractionDir } from '~/utils/tempManager.server'
import type { GameDetails } from './grid.$romdata'

//ORDERED list of disk image filetypes we'll support extraction of (subtlety here is we must extract ALL the image files and find the RUNNABLE file)
const diskImageExtensions = ['.chd', '.nrg', '.mdf', '.img', '.ccd', '.cue', '.bin', '.iso']

//only one game can be run by me at a time - we don't want to use exec, we may want to be able to navigate qp for maps, walkthroughs, keybindings
let currentProcess = null
let currentGameDetails = null

const eventThrottleState = {
  lastEventType: null,
  consecutiveCount: 0,
  lastEventTime: 0
}

//SSE: emit is sync - delay for two reasons: (1) events too close clobber each other (2) lack of await working sensibly for node-7z-archive operations
async function emitEvent({ type, data }: { type: string; data: string }) {
  await new Promise(resolve => setTimeout(resolve, 100))
  emitter.emit('runGameEvent', { type, data })
}

export async function action({ request }: ActionFunctionArgs) {
  const gameDetails: GameDetails = await request.json()

  //popup an alert to the user that if emulators is [] they won't be able to run any games
  const emulators = loadEmulators()
  if (emulators.length === 0) {
    await emitEvent({ type: 'QPBackend', data: 'No emulators available, cannot run any games' })
    return null
  }

  // Now check for MULTILOADER preference early in the process
  const matchedEmulator = emulators.find(emulator => emulator.emulatorName === gameDetails.emulatorName)
  if (matchedEmulator && (matchedEmulator.parameters ?? '').includes('%Tool:MULTILOADER%')) {
    // Use the robust parser to split the command
    const splitMultiloaderCMD = command => {
      const args = []
      let currentArg = ''
      let inQuote = false

      for (let i = 0; i < command.length; i++) {
        const char = command[i]

        if (char === '"') {
          if (inQuote) {
            args.push(currentArg)
            currentArg = ''
            inQuote = false
          } else {
            inQuote = true
          }
        } else if (char === ' ' && !inQuote) {
          if (currentArg) {
            args.push(currentArg)
            currentArg = ''
          }
        } else {
          currentArg += char
        }
      }

      if (currentArg) {
        args.push(currentArg)
      }

      return args
    }

    const multiloaderParams = splitMultiloaderCMD(matchedEmulator.parameters)

    // Check if the last parameter is a disk image format specifier (3 chars)
    if (multiloaderParams.length > 0) {
      const lastParam = multiloaderParams[multiloaderParams.length - 1]
      if (lastParam && lastParam.length === 3) {
        const diskImageExt = diskImageExtensions.find(ext => ext.substring(1).toLowerCase() === lastParam.toLowerCase())
        if (diskImageExt) {
          gameDetails.preferredDiskImageExt = diskImageExt
          logger.log(`fileOperations`, `Early detection: Will prefer ${diskImageExt} files from MULTILOADER params`)
        }
      }
    }
  }

  // Then continue with existing code...
  console.dir(gameDetails)

  //method to reset the 'game already running' dialogs - needs work
  if (gameDetails.clearProcess) {
    currentProcess = null
    currentGameDetails = null
    return null
  }

  // Find the selected emulator and check its compression support
  if (matchedEmulator) {
    const compressionSupport = decodeCompressionSupport(matchedEmulator.Compression)
    logger.log(`fileOperations`, `Emulator compression support:`, compressionSupport)
    await emitEvent({
      type: 'QPBackend',
      data: `Archive support: ${
        Object.entries(compressionSupport)
          .filter(([_, supported]) => supported)
          .map(([format]) => format)
          .join(', ') || 'None'
      }`
    })
  }

  logger.log(`fileOperations`, `runGame received from grid`, gameDetails)
  await emitEvent({ type: 'QPBackend', data: 'Going to run ' + gameDetails.gamePath })

  //TODO: should be an .env variable with a ui to set (or something on romdata conversation?)
  const gamePathOS = convertPathToOSPath(gameDetails.gamePath)

  // Check if the emulator supports direct loading of this archive type
  const gameExtension = path.extname(gamePathOS).toLowerCase()
  const isZip = sevenZipFileExtensions.map(ext => ext.toLowerCase()).includes(gameExtension)

  // For emulators with archive support, we can pass the archive directly
  // unless it's a goodmerge collection which requires ROM selection
  if (isZip && matchedEmulator && gameDetails.collectionType !== 'goodmerge') {
    // FIRST check if this is a MULTILOADER tool - these ALWAYS need extraction
    // regardless of what their compression flags say - TODO: obv this is ALL a conversion-time problem
    if ((matchedEmulator.parameters ?? '').includes('%Tool:MULTILOADER%')) {
      logger.log(
        `fileOperations`,
        `MULTILOADER tool detected - these always require extraction regardless of compression flags`
      )
      await emitEvent({
        type: 'QPBackend',
        data: `MULTILOADER tool requires archive extraction`
      })
      // Continue to normal extraction flow - don't return here
    } else {
      // Normal emulators - check actual compression support
      const compressionSupport = decodeCompressionSupport(matchedEmulator.Compression)
      const extensionWithoutDot = gameExtension.substring(1) // Remove leading dot

      // Map common extensions to their key in compressionSupport
      const extensionMap = {
        zip: 'zip',
        '7z': '7z',
        rar: 'rar',
        ace: 'ace'
      }

      const compressionKey = extensionMap[extensionWithoutDot]

      // Check if this archive type is directly supported
      if (compressionKey && compressionSupport[compressionKey]) {
        logger.log(`fileOperations`, `Emulator supports ${gameExtension} archives directly, no extraction needed`)
        await emitEvent({
          type: 'QPBackend',
          data: `Running ${gameExtension} archive directly (supported by ${gameDetails.emulatorName})`
        })
        await runGame(gamePathOS, gameDetails)
        return null
      }
    }
  }

  // //if we're mame, we don't want to extract (nor create an empty folder in extraction dir)
  // //TODO: still required - I suspect we have non-goodmerge mame excluusions in the original qp code
  // if (isMame(gameDetails.emulatorName)) {
  //   await emitEvent({ type: 'QPBackend', data: 'MAME game detected, running directly' })
  //   await runGame(gamePathOS, gameDetails)
  //   return null
  // }

  //archives could be both disk images or things like goodmerge sets.
  if (isZip) {
    // Create archive-specific extraction directory
    const outputDirectory = await getAndEnsureTempDir(gamePathOS, gameDetails.system)
    await emitEvent({ type: 'QPBackend', data: 'Zip detected passing to 7z ' + gamePathOS })
    await emitEvent({ type: 'status', data: 'isZip' })
    await examineZip(gamePathOS, outputDirectory, gameDetails)
  } else {
    await emitEvent({ type: 'QPBackend', data: 'Game File detected, directly running ' + gamePathOS })
    await runGame(gamePathOS, gameDetails)
  }
  return null
}

async function examineZip(gamePathOS, outputDirectory, gameDetails: GameDetails) {
  const { onlyArchive, listArchive, fullArchive } = await loadNode7z()

  logger.log(`fileOperations`, 'listing archive', gamePathOS)
  await emitEvent({ type: 'zip', data: 'listing archive contents: ' + gamePathOS })

  try {
    const result = await new Promise((resolve, reject) => {
      listArchive(gamePathOS)
        .progress(async (files: { name: string }[]) => {
          if (files.length === 0) {
            reject('no files found in archive')
            return
          }

          // Log the archive contents
          await emitEvent({
            type: 'zip',
            data: 'listed archive:\n' + files.map(file => `\t${file.name}`).join('\n')
          })

          // Case 1: User specified a file to run - check if it exists
          if (gameDetails.fileInZipToRun) {
            const fileExists = files.some(file => file.name === gameDetails.fileInZipToRun)
            if (fileExists) {
              logger.log(`fileOperations`, `Found specified file in archive: ${gameDetails.fileInZipToRun}`)
              await emitEvent({ type: 'zip', data: `Found specified file: ${gameDetails.fileInZipToRun}` })
              await extractSingleRom(gamePathOS, outputDirectory, gameDetails.fileInZipToRun, onlyArchive, logger)
              const outputFile = path.join(outputDirectory, gameDetails.fileInZipToRun)
              await runGame(outputFile, gameDetails)
            } else {
              logger.log(`fileOperations`, `Warning: Specified file ${gameDetails.fileInZipToRun} not found in archive`)
              await emitEvent({ type: 'zip', data: `Warning: Specified file not found: ${gameDetails.fileInZipToRun}` })
              // Continue with normal processing since the specified file wasn't found
            }
          }

          // Case 2: Only one file in the archive - extract and run it directly
          else if (files.length === 1) {
            const singleFileName = files[0].name
            logger.log(`fileOperations`, `Archive contains only one file: ${singleFileName}, extracting directly`)
            await emitEvent({ type: 'zip', data: `Single file archive, using: ${singleFileName}` })
            await extractSingleRom(gamePathOS, outputDirectory, singleFileName, onlyArchive, logger)
            const outputFile = path.join(outputDirectory, singleFileName)
            await runGame(outputFile, gameDetails)
          }

          // Case 3: Multiple files - use existing logic for disk images or goodmerge
          else {
            // Check if this is a disk image collection
            const pickedRom = await handleDiskImages(files, gamePathOS, outputDirectory, fullArchive, gameDetails)
            if (pickedRom) {
              const outputFile = path.join(outputDirectory, pickedRom)
              await emitEvent({
                type: 'QPBackend',
                data: 'running runnable iso file' + outputFile
              })
              await runGame(outputFile, gameDetails)
            }
            // Handle based on collection type
            else {
              const pickedRom = await handleNonDiskImages(files, gamePathOS, outputDirectory, onlyArchive, gameDetails)
              const outputFile = path.join(outputDirectory, pickedRom)
              await runGame(outputFile, gameDetails)
            }
          }

          resolve(files)
        })
        .then(archivePathsSpec => {
          if (archivePathsSpec) {
            logger.log(`fileOperations`, `listed this archive: `, archivePathsSpec)
            resolve(archivePathsSpec)
          }
        })
        .catch(err => {
          console.error('error listing archive: ', err)
          emitter.emit('runGameEvent', { type: 'status', data: 'zip-error ' + err })
          reject(err)
        })
    })
    return result
  } catch (error) {
    logger.log('fileOperations', 'Failed to process archive:', error)
    return null
  }
}

//first look for ANY of the files from the image list, if any are found, treat it as an image, THEN look in order for runnable files, extract all and then pass RUNNABLE file to emu
async function handleDiskImages(files, gamePathOS, outputDirectory, fullArchive, gameDetails) {
  logger.log('fileOperations', `checking for disk images in files`, files)
  const diskImageFiles = files.filter(file => diskImageExtensions.includes(path.extname(file.name).toLowerCase()))

  if (diskImageFiles.length > 0) {
    logger.log(`fileOperations`, `found disk image files in archive`, diskImageFiles)
    await emitEvent({ type: 'QPBackend', data: 'found disk image file to run (extracting full archive)' })
    await extractFullArchive(gamePathOS, outputDirectory, fullArchive, logger)

    let pickedRom = null

    // Add more detailed logging for debugging
    logger.log(`fileOperations`, `Available disk image files: ${diskImageFiles.map(f => f.name).join(', ')}`)
    logger.log(`fileOperations`, `Preferred disk image extension: ${gameDetails?.preferredDiskImageExt || 'None'}`)

    // Check if we have a preferred extension from MULTILOADER
    if (gameDetails?.preferredDiskImageExt) {
      // Make sure we're comparing properly - ensure ext starts with '.'
      const prefExt = gameDetails.preferredDiskImageExt.startsWith('.')
        ? gameDetails.preferredDiskImageExt.toLowerCase()
        : `.${gameDetails.preferredDiskImageExt.toLowerCase()}`

      logger.log(`fileOperations`, `Looking for files with preferred extension: ${prefExt}`)

      // More careful matching - make sure we're comparing the same things
      for (const file of diskImageFiles) {
        const fileExt = path.extname(file.name).toLowerCase()
        logger.log(`fileOperations`, `Comparing ${fileExt} with ${prefExt}`)

        if (fileExt === prefExt) {
          pickedRom = file.name
          logger.log(`fileOperations`, `Found matching preferred disk image: ${pickedRom}`)
          break
        }
      }
    }

    // If no preferred file found, fall back to the default order
    if (!pickedRom) {
      for (const ext of diskImageExtensions) {
        const matchingFile = diskImageFiles.find(file => path.extname(file.name).toLowerCase() === ext.toLowerCase())
        if (matchingFile) {
          pickedRom = matchingFile.name
          logger.log(`fileOperations`, `Using file based on default disk image priority: ${pickedRom}`)
          break
        }
      }
    }

    return pickedRom
  }
  return null
}

async function handleNonDiskImages(files, gamePathOS, outputDirectory, onlyArchive, gameDetails: GameDetails) {
  //if its not a disk image, we can just pick the best runnable file to pass to the emu
  const filenames = files.map(file => file.name)
  logger.log(`fileOperations`, `7z listing: `, filenames)

  let pickedRom

  // Choose extraction method based on collection type
  if (gameDetails.collectionType === 'goodmerge') {
    logger.log(`fileOperations`, `Processing GoodMerge collection`)
    await emitEvent({ type: 'QPBackend', data: 'GoodMerge collection detected, choosing best ROM version' })
    pickedRom = setupChooseGoodMergeRom(filenames, logger)
    logger.log(`fileOperations`, `GoodMerge algorithm picked this rom:`, pickedRom)
    await emitEvent({ type: 'QPBackend', data: 'GoodMerge choosing selected: ' + pickedRom })
  } else if (filenames.length > 1) {
    // For non-GoodMerge collections with multiple files, ask the user to choose
    logger.log(`fileOperations`, `Multiple files in archive, prompting user to select`)
    await emitEvent({ type: 'QPBackend', data: 'Multiple files found, waiting for file selection...' })

    // Send the file list to the frontend and wait for user selection
    pickedRom = await promptUserForFileSelection(filenames, gamePathOS)

    if (!pickedRom) {
      // User cancelled or something went wrong
      logger.log(`fileOperations`, `File selection cancelled or failed`)
      await emitEvent({ type: 'QPBackend', data: 'File selection cancelled' })
      throw new Error('File selection cancelled')
    }

    logger.log(`fileOperations`, `User selected file: ${pickedRom}`)
    await emitEvent({ type: 'QPBackend', data: 'Selected file: ' + pickedRom })
  } else {
    // Only one file, use it directly
    pickedRom = filenames[0]
    logger.log(`fileOperations`, `Only one file in archive, using: ${pickedRom}`)
    await emitEvent({ type: 'QPBackend', data: 'Using only available file: ' + pickedRom })
  }

  await extractSingleRom(gamePathOS, outputDirectory, pickedRom, onlyArchive, logger)
  return pickedRom
}

// New function to prompt the user to select a file
async function promptUserForFileSelection(files, archivePath) {
  // Generate a unique request ID to match the response
  const requestId = Date.now().toString()

  // Create a promise that will be resolved when the user makes a selection
  return new Promise((resolve, reject) => {
    // Set up a one-time event listener for the file selection response
    const responseHandler = response => {
      if (response.requestId === requestId) {
        // Clean up the listener
        emitter.removeListener('fileSelectionResponse', responseHandler)

        if (response.cancelled) {
          reject(new Error('File selection cancelled'))
        } else {
          resolve(response.selectedFile)
        }
      }
    }

    // Listen for the response
    emitter.on('fileSelectionResponse', responseHandler)

    // Set a timeout in case the user never responds
    const timeout = setTimeout(() => {
      emitter.removeListener('fileSelectionResponse', responseHandler)
      reject(new Error('File selection timed out'))
    }, 60000) // 1 minute timeout

    // Send the request to the frontend
    emitter.emit('runGameEvent', {
      type: 'fileSelection',
      data: JSON.stringify({
        requestId,
        files,
        archivePath
      })
    })

    logger.log(`fileOperations`, `Sent file selection request to frontend, waiting for response...`)
  })
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

  // Check if the file is already extracted
  // We pass just the filename when extracting a single ROM
  const isAlreadyExtracted = await verifyExtraction(outputDirectory, romInArchive)
  if (isAlreadyExtracted) {
    logger.log(`fileOperations`, `File already extracted, reusing: ${romInArchive}`)
    // emitter.emit('runGameEvent', { type: 'status', data: 'zip-success' })
    await emitEvent({ type: 'zip', data: 'Using previously extracted file' })
    return outputDirectory
  }

  // Wrap old-style promise in async/await
  const result = await new Promise((resolve, reject) => {
    onlyArchive(gamePath, outputDirectory, romInArchive)
      .then(result => {
        //result is always undefined - expected?
        logger.log(`fileOperations`, `extracting single file with 7z:`, gamePath)
        touchExtractionDir(outputDirectory) // Update timestamp
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
  // To verify a full archive extraction, we need the list of files
  // We'll need to get this from the listArchive function first
  let fileList = null

  try {
    const { listArchive } = await loadNode7z()
    // Get the file list with sizes first
    const filesInArchive = await new Promise((resolve, reject) => {
      let files = []
      listArchive(gamePath)
        .progress(items => {
          files = items // This contains {name: string, size: number}
        })
        .then(() => resolve(files))
        .catch(err => reject(err))
    })

    fileList = filesInArchive
  } catch (err) {
    logger.log('fileOperations', `Couldn't get archive file list: ${err}`)
    // Continue with basic verification if we can't get the list
  }

  // Now verify with the file list if we have it
  const isAlreadyExtracted = await verifyExtraction(outputDirectory, fileList)
  if (isAlreadyExtracted) {
    logger.log(`fileOperations`, `Archive already extracted, reusing contents`)
    await emitEvent({ type: 'zip', data: 'Using previously extracted files' })
    emitter.emit('runGameEvent', { type: 'status', data: 'zip-success' })
    return outputDirectory
  }

  const result = await new Promise((resolve, reject) => {
    fullArchive(gamePath, outputDirectory)
      .then(result => {
        logger.log(`fileOperations`, `extracting all files with 7z:`, result)
        touchExtractionDir(outputDirectory) // Update timestamp
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

async function runGame(outputFile: string, gameDetails: GameDetails) {
  // Early existing process check
  if (currentProcess) {
    logger.log(`fileOperations`, 'An emulator is already running. Please close it before launching a new game.')
    await emitEvent({
      type: 'onlyOneEmu',
      data: `An emulator is already running: ${currentGameDetails?.name ?? 'Unknown'} with ${
        currentGameDetails?.emulatorName ?? 'Unknown'
      }. Please close it before launching a new game.`
    })
    return
  }

  // Match emulator
  const matchedEmulator = matchEmulatorName(gameDetails.emulatorName)
  logger.log(`fileOperations`, 'Matched Emulator:', matchedEmulator)
  if (!matchedEmulator) {
    logger.log(`fileOperations`, 'Emulator not found')
    return
  }

  // Generate platform-specific command lines for logging
  const darwinCmd = generateDarwinCommandLine(outputFile, matchedEmulator, gameDetails)
  const windowsCmd = generateWindowsCommandLine(outputFile, matchedEmulator, gameDetails)

  // Log both command lines for development purposes
  logger.log(`fileOperations`, '️🖥️ Windows command line would be:', windowsCmd.fullCommandLine)
  logger.log(`fileOperations`, ' 🍎 macOS command line would be:', darwinCmd.fullCommandLine)

  // Platform-specific launching logic
  if (process.platform === 'darwin') {
    // Mac launch - use standard spawn with params
    const { emuPath, emuParams, fullCommandLine } = darwinCmd
    logger.log(`fileOperations`, ` ✅ Using macOS command: ${fullCommandLine}`)

    // Send the command line to the UI
    await emitEvent({ type: 'QPBackend', data: `Launching: ${fullCommandLine}` })

    currentProcess = spawn(emuPath, emuParams, {
      cwd: path.dirname(emuPath)
    })
  } else {
    // Windows launch - determine if this is a console application
    const { emuPath, fullCommandLine } = windowsCmd
    logger.log(`fileOperations`, ` ✅ Using Windows command: ${fullCommandLine}`)

    // Send the command line to the UI
    await emitEvent({ type: 'QPBackend', data: `Launching: ${fullCommandLine}` })

    // Check if this is a console application
    const isConsole = await isConsoleApplication(emuPath)

    // Create spawn options based on app type
    const spawnOptions = {
      cwd: path.dirname(emuPath),
      shell: true, // Always use shell for Windows commands
      windowsHide: isConsole ? false : true, // Only show window for console apps
      detached: isConsole // Only detach for console apps
    }

    if (isConsole) {
      logger.log('fileOperations', `Detected console application, launching with visible console window`)
    }

    // Use the full command string for Windows
    currentProcess = spawn(fullCommandLine, [], spawnOptions)

    // Special handling for console applications
    if (isConsole) {
      // Unref the child so Node doesn't wait for it to close
      currentProcess.unref()

      // Emit status and inform the user
      await emitEvent({ type: 'status', data: 'running' })
      await emitEvent({ type: 'QPBackend', data: 'Console application launched in separate window' })

      // Still capture close event for cleanup
      currentProcess.on('close', code => {
        logger.log(`fileOperations`, `Console process exited with code ${code}`)
        currentProcess = null
        currentGameDetails = null
        emitter.emit('runGameEvent', { type: 'status', data: 'closed' })
      })

      return
    }
  }

  // Common handling for all non-console applications
  currentGameDetails = { name: outputFile, emulatorName: gameDetails.emulatorName }

  // Emit status when game starts
  await emitEvent({ type: 'status', data: 'running' })

  // Setup event handlers (keep existing code)
  currentProcess.stdout.on('data', data => {
    const dataStr = data.toString()
    logger.log(`fileOperations`, `Output: ${dataStr}`)
    emitSyncEvent('EmuLog', dataStr)
  })

  currentProcess.stderr.on('data', data => {
    const dataStr = data.toString()
    logger.log(`fileOperations`, `Error: ${dataStr}`)
    emitSyncEvent('EmuErrLog', dataStr)
  })

  currentProcess.on('close', code => {
    logger.log(`fileOperations`, `Process exited with code ${code}`)
    // First emit the close event
    emitSyncEvent('close', `Process exited with code ${code}`)

    // Then wait a significant time before sending the status change
    setTimeout(() => {
      // Use emitSyncEvent instead of direct emit to keep throttling benefits
      emitSyncEvent('status', 'closed')

      // Clean up after the status is sent
      currentProcess = null
      currentGameDetails = null
    }, 500) // Half second delay between these critical events
  })
}

 // Enhanced throttling with better batching for all event types
function emitSyncEvent(type, data) {
  const now = Date.now()

  // Check if this is the same type of event as the last one
  if (type === eventThrottleState.lastEventType) {
    eventThrottleState.consecutiveCount++

    // For rapidly firing events of the same type,
    // use much more aggressive throttling
    const timeSinceLast = now - eventThrottleState.lastEventTime

    // If events are coming in faster than 150ms apart (increased from 100ms)
    if (timeSinceLast < 150) {
      // More aggressive throttling - increase both the multiplier and cap
      const dynamicDelay = Math.min(eventThrottleState.consecutiveCount * 25, 350) // Increased from 15×250

      // For all event types, use more aggressive skipping
      if (eventThrottleState.consecutiveCount > 2) {
        // Decreased threshold from 3 to 2
        // Skip every other event from the start
        if (eventThrottleState.consecutiveCount % 2 !== 0) {
          console.log(`[PROCESS EVENT] Skipping burst event #${eventThrottleState.consecutiveCount} (type: ${type})`)
          eventThrottleState.lastEventTime = now
          return // Skip this event
        }

        // For longer bursts, be even more aggressive
        if (eventThrottleState.consecutiveCount >= 8 && eventThrottleState.consecutiveCount % 3 !== 0) {
          // Changed from 10→4 to 8→3
          console.log(
            `[PROCESS EVENT] Skipping heavy burst event #${eventThrottleState.consecutiveCount} (type: ${type})`
          )
          eventThrottleState.lastEventTime = now
          return // Skip this event
        }
      }

      // Use busy-wait for consistent timing
      const start = Date.now()
      while (Date.now() - start < dynamicDelay) {}
    }
  } else {
    // Different event type - add a longer pause when switching types
    // This helps ensure the browser has processed all previous events
    const start = Date.now()
    while (Date.now() - start < 120) {} // Increased from 0 to 120ms

    // Reset counter
    eventThrottleState.consecutiveCount = 1
  }

  // Update state for next time
  eventThrottleState.lastEventType = type
  eventThrottleState.lastEventTime = now

  // Add our standard minimal delay for all events
  const start = Date.now()
  while (Date.now() - start < 20) {} // Increased from 10ms to 20ms

  console.log(`[PROCESS EVENT] Emitting ${type}: ${data.substring(0, 50)}${data.length > 50 ? '...' : ''}`)
  emitter.emit('runGameEvent', { type, data })
} 

// Function to generate macOS RetroArch command line
function generateDarwinCommandLine(outputFile, matchedEmulator, gameDetails) {
  const retroarchCommandLine = extractRetroarchCommandLine(matchedEmulator)
  logger.log(`fileOperations`, 'Retroarch Command Line On Mac:', retroarchCommandLine)
  const retroarchExe = '/Applications/Retroarch.app/Contents/MacOS/RetroArch'
  //get the retroarch core dir
  const homeDir = os.homedir()
  const retroarchDir = path.join(homeDir, 'Library', 'Application Support', 'RetroArch')
  const libretroCore = path.join(retroarchDir, retroarchCommandLine)
  const flagsToEmu = '-v -f'
  const emuParams = [outputFile, '-L', libretroCore, ...flagsToEmu.split(' ')]
  const emuPath = retroarchExe

  // Create the full command line for logging/debugging
  const fullCommandLine = `${emuPath} ${
    emuParams
      ? emuParams.map(param => (param.includes(' ') && !param.startsWith('"') ? `"${param}"` : param)).join(' ')
      : ''
  }`

  return { emuPath, emuParams, fullCommandLine }
}

// Function to generate Windows command line with various parameter substitutions
function generateWindowsCommandLine(outputFile, matchedEmulator, gameDetails) {
  // Use nullish coalescing for safer property access
  let emuParamsStr = matchedEmulator.parameters ?? ''

  let preferredDiskImageExt = null // Track preferred disk image extension

  // Handle MULTILOADER case first (this is special)
  if (emuParamsStr.includes('%Tool:MULTILOADER%')) {
    // Use a regex to split the command line respecting quotes
    const splitMultiloaderCMD = command => {
      // Manual parsing approach that properly handles empty quoted strings
      const args = []
      let currentArg = ''
      let inQuote = false

      for (let i = 0; i < command.length; i++) {
        const char = command[i]

        if (char === '"') {
          if (inQuote) {
            // Closing quote - add the argument even if empty
            args.push(currentArg)
            currentArg = ''
            inQuote = false
          } else {
            // Opening quote
            inQuote = true
          }
        } else if (char === ' ' && !inQuote) {
          // Space outside quotes - end of argument
          if (currentArg) {
            args.push(currentArg)
            currentArg = ''
          }
        } else {
          // Regular character - add to current argument
          currentArg += char
        }
      }

      // Add the final argument if there is one
      if (currentArg) {
        args.push(currentArg)
      }

      return args
    }

    const multiloaderParams = splitMultiloaderCMD(emuParamsStr)
    logger.log('fileOperations', 'MULTILOADER params:', multiloaderParams)

    // Check if the last parameter is a disk image format specifier (3 chars)
    // This is the pcsxe 'bin instead of cue' case, which the multiloader tool handled - there's one more case of 'iso' for a very old cdi-emulator
    if (multiloaderParams.length > 0) {
      const lastParam = multiloaderParams[multiloaderParams.length - 1]
      if (lastParam && lastParam.length === 3) {
        // Check if it matches any of our supported disk image types (without the dot)
        const matchingExt = diskImageExtensions.find(ext => ext.substring(1).toLowerCase() === lastParam.toLowerCase())
        if (matchingExt) {
          preferredDiskImageExt = matchingExt
          logger.log(`fileOperations`, `MULTILOADER specified preferred disk image type: ${preferredDiskImageExt}`)
        }
      }
    }

    const multiloaderRealFlagIndex = 3 // Always use the fourth parameter in MULTILOADER case

    if (multiloaderParams.length > multiloaderRealFlagIndex) {
      const emulatorFlags = multiloaderParams[multiloaderRealFlagIndex]

      // Handle the case where the flags might be empty string
      if (emulatorFlags === '') {
        // Just use the output file without additional flags
        emuParamsStr = `"${outputFile}"`
        logger.log(`fileOperations`, `MULTILOADER: Using no flags with ${outputFile} (empty parameter)`)
      } else {
        // Set parameters to output file followed by emulator flags
        emuParamsStr = `"${outputFile}" ${emulatorFlags}`
        logger.log(`fileOperations`, `MULTILOADER: Using ${emulatorFlags} with ${outputFile}`)
      }
    } else {
      logger.log(`fileOperations`, `Warning: MULTILOADER parameters incomplete: ${emuParamsStr}`)
    }
  } else {
    // For non-MULTILOADER case, handle all parameter replacements

    // Handle parameters from romdata first
    if (gameDetails.parameters) {
      const paramModeInt = gameDetails.paramMode != null ? parseInt(gameDetails.paramMode) : NaN
      if (paramModeInt == 0) emuParamsStr = `${emuParamsStr} ${gameDetails.parameters}`
      if (paramModeInt == 1) emuParamsStr = gameDetails.parameters
      if (paramModeInt == 2) emuParamsStr = `${gameDetails.parameters} ${emuParamsStr}`
      if (paramModeInt == 3) emuParamsStr = `${emuParamsStr}${gameDetails.parameters}`
      if (paramModeInt == 4) emuParamsStr = `${gameDetails.parameters}${emuParamsStr}`
    }

    // Replace all placeholder patterns in a single pass (not defensive: we know we have rom and exe)
    const replacements = [
      { pattern: /%ROM%/g, value: outputFile },
      { pattern: /%SHORTROM%/g, value: outputFile }, // This seems to be equivalent to ROM in the current code
      { pattern: /%ROMFILENAME%/g, value: path.basename(outputFile) },
      { pattern: /%ROMFILENAMENOEXT%/g, value: path.basename(outputFile).replace(/\.[^/.]+$/, '') },
      { pattern: /%ROMDIR%/g, value: path.dirname(outputFile) },
      { pattern: /%EXEDIR%/g, value: path.dirname(matchedEmulator.path) + path.sep }, //sep original qp behaviour
      // ROMMAME is special because it depends on gameDetails
      {
        pattern: /%ROMMAME%/g,
        value: gameDetails?.mameName || gameDetails?.parentName || ''
      }
    ]

    // Apply all replacements
    replacements.forEach(({ pattern, value }) => {
      if (value) {
        // Only replace if we have a valid value
        emuParamsStr = emuParamsStr.replace(pattern, value)
      }
    })

    // Check if we missed any replacements and log a warning
    const remainingPlaceholders = emuParamsStr.match(/%[^%]+%/g)
    if (remainingPlaceholders) {
      logger.log(
        `fileOperations`,
        `Warning: Unsupported placeholders in parameters: ${remainingPlaceholders.join(', ')}`
      )
    }
  }

  // For Windows, simplify by just returning the full command string
  const emuPath = matchedEmulator.path
  const fullCommandLine = `${emuPath} ${emuParamsStr || ''}`
  return { emuPath, fullCommandLine, preferredDiskImageExt }
}

//we load emulators dynamically in case its been altered (for instance in case we had NO emulators when app first loaded, and then they were imported)
function matchEmulatorName(emulatorName) {
  const emulators = loadEmulators()
  return emulators.find(emulator => emulator.emulatorName === emulatorName)
}

function isMame(emulatorName) {
  const matchedEmulator = matchEmulatorName(emulatorName)
  //temporary fix: it isn't QUITE good enough to say a rom is mame if we call ROMMAME, otherGameNames etc...so also this:
  const isMameEmulator =
    matchedEmulator?.emulatorName?.startsWith('MAME') || matchedEmulator?.emulatorName?.endsWith('(MAME)')

  // More robust find function that handles all edge cases
  const find = (str, start, end) => {
    if (!str) return null // Handle undefined/null string
    const match = str.match(new RegExp(`${start}(.*?)${end}`))
    return match && match.length > 1 ? match[1] : null // Handle no match or no capture group
  }

  const namedOutputType = find(matchedEmulator?.parameters, '%', '%')
  const isMameRom = namedOutputType === 'ROMMAME'
  return isMameEmulator || isMameRom
}

function extractRetroarchCommandLine(emulatorJson) {
  // Safely extract parameters with default empty string
  const parameters = emulatorJson.parameters ?? ''
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

// Function to get temp dir path and ensure it exists
async function getAndEnsureTempDir(archivePath = null, system = 'Unknown') {
  if (archivePath) {
    return getArchiveExtractionDir(archivePath, system)
  } else {
    // Fall back to original behavior if no archive path provided
    const tempDir = getTempDirectory()
    await createDirIfNotExist(tempDir)
    return tempDir
  }
}

// Function to check if an executable is a console application (Windows only)
async function isConsoleApplication(exePath) {
  if (process.platform !== 'win32') return false;
  
  try {
    // Read the first few bytes of the executable to access the PE header
    const fs = require('fs').promises;
    const buffer = Buffer.alloc(1024); // Should be enough for the PE header
    const fileHandle = await fs.open(exePath, 'r');
    await fileHandle.read(buffer, 0, buffer.length, 0);
    await fileHandle.close();
    
    // Check for MZ header (first two bytes of a Windows executable)
    if (buffer[0] !== 0x4D || buffer[1] !== 0x5A) return false;
    
    // Get the offset to the PE header
    const peOffset = buffer.readUInt32LE(0x3C);
    if (peOffset > buffer.length) return false;
    
    // Check for PE header signature
    if (buffer.readUInt32LE(peOffset) !== 0x00004550) return false;
    
    // The subsystem value is at offset 0x5C from the PE header
    const subsystemOffset = peOffset + 0x5C;
    const subsystem = buffer.readUInt16LE(subsystemOffset);
    
    // Subsystem 3 is WINDOWS_CUI (Console), subsystem 2 is WINDOWS_GUI
    logger.log('fileOperations', `Executable subsystem: ${subsystem === 3 ? 'Console' : 'GUI'}`);
    return subsystem === 3;
  } catch (err) {
    logger.log('fileOperations', `Error checking executable type: ${err.message}`);
    return false; // Default to GUI application if we can't determine
  }
}
