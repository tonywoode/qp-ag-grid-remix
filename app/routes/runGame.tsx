import { spawn } from 'child_process'
import type { ActionFunctionArgs } from '@remix-run/node'
import path from 'path'
import { chooseGoodMergeRom } from '~/utils/goodMergeChooser'
import { createDirIfNotExist } from '../utils/createDirIfNotExist'
import { logger } from '../root'
import emulators from '~/../dats/emulators.json'
import { convertWindowsPathToMacPath } from '~/utils/OSConvert.server'
import { emitter } from '~/utils/emitter.server'

// unordered list of archive filetypes (from 7Zips homepage) that we'll support
const sevenZipSupportedExtensions = ['.7z', '.bzip2', '.dmg', '.gzip', '.lzma', '.rar', '.rar5', '.tar', '.xar', '.zip', '.zipx']
// ordered list of disk image filetypes
const diskImageExtensions = ['.chd', '.nrg', '.mdf', '.img', '.ccd', '.cue', '.bin', '.iso']

//only one game can be run by me at a time - we don't want to use exec, we may want to be able to navigate qp for maps, walkthroughs, keybindings
let currentProcess = null
let currentGameDetails = null

//SSE: emit is sync - delay for two reasons: (1) events too close clobber each other (2) lack of await working sensibly for node-7z-archive operations
async function emitEvent({ type, data }: { type: string; data: string }) {
  await new Promise(resolve => setTimeout(resolve, 100))
  emitter.emit('runGameEvent', { type, data })
}

//ORDERED list of disk image filetypes we'll support extraction of (subtlety here is we must extract ALL the image files and find the RUNNABLE file)

//unordered list of archive filetypes (from 7Zips homepage) that we'll support (don't extract iso etc - which it also supports!)

export async function action({ request }: ActionFunctionArgs) {
  const { gamePath, fileInZipToRun, emulatorName, clearProcess } = await request.json()
  if (clearProcess) {
    currentProcess = null
    currentGameDetails = null
    return null
  }
  logger.log(`fileOperations`, `runGame received from grid`, { gamePath, fileInZipToRun, emulatorName })
  await emitEvent({ type: 'QPBackend', data: 'Going to run ' + gamePath })
  //TODO: should be an .env variable with a ui to set (or something on romdata conversation?)
  const gamePathMacOS = convertWindowsPathToMacPath(gamePath)
  const outputDirectory = setTempDir()
  const gameExtension = path.extname(gamePathMacOS).toLowerCase()
  //archives could be both disk images or things like goodmerge sets. TODO: some emulators can run zipped roms directly
  const isZip = sevenZipSupportedExtensions.map(ext => ext.toLowerCase()).includes(gameExtension)

  if (isZip) {
    await emitEvent({ type: 'QPBackend', data: 'Zip detected passing to 7z ' + gamePathMacOS })
    await emitEvent({ type: 'status', data: 'isZip' }) // Add this line to emit zip status
    await examineZip(gamePathMacOS, outputDirectory, fileInZipToRun, emulatorName)
  } else {
    await emitEvent({ type: 'QPBackend', data: 'Game File detected, directly running ' + gamePathMacOS })
    await runGame(gamePathMacOS, emulatorName)
  }
  return null
}

async function examineZip(gamePathMacOS, outputDirectory, fileInZipToRun, emulatorName) {
  //you can move the below above here once you upgrade remix, top level await will work
  //its an ESM module, use dynamic import inline here, don't try adding it to the serverDependenciesToBundle in remix.config.js, that won't work
  const { onlyArchive, listArchive, fullArchive } = await import('node-7z-archive')
  if (fileInZipToRun) {
    await emitEvent({ type: 'zip', data: 'unzipping with a running file specified ' + fileInZipToRun })
    //meaning row in the grid contains a pre-selected preferred rom to extract
    await extractSingleRom(gamePathMacOS, outputDirectory, fileInZipToRun, onlyArchive, logger)
    const outputFile = path.join(outputDirectory, fileInZipToRun)
    runGame(outputFile, emulatorName)
  } else {
    logger.log(`fileOperations`, 'listing archive', gamePathMacOS)
    await emitEvent({ type: 'zip', data: 'listing archive to find runnable file ' + gamePathMacOS })
    try {
      const result = await new Promise((resolve, reject) => {
        listArchive(gamePathMacOS)
          .progress(async (files: { name: string }[]) => {
            console.log('files is: ' + files)
            if (files.length > 0) {
              await emitEvent({
                type: 'zip',
                data: 'listed archive:\n' + files.map(file => `\t${file.name}`).join('\n')
              })
              // emitter.emit('runGameEvent', { type: 'status', data: 'zip-success' }) // don't add success status if all we've done is list
              const pickedRom = await handleDiskImages(files, gamePathMacOS, outputDirectory, fullArchive)
              if (pickedRom) {
                const outputFile = path.join(outputDirectory, pickedRom)
                await emitEvent({type: 'QPBackend', data: 'running runnable iso file' + outputFile}) //prettier-ignore
                await runGame(outputFile, emulatorName)
                return files
              } else {
                const pickedRom = await handleNonDiskImages(files, gamePathMacOS, outputDirectory, onlyArchive)
                const outputFile = path.join(outputDirectory, pickedRom)
                await runGame(outputFile, emulatorName)
                return files
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

async function runGame(outputFile: string, emulatorName: string) {
  if (currentProcess) {
    logger.log(`fileOperations`, 'An emulator is already running. Please close it before launching a new game.')
    await emitEvent({
      type: 'onlyOneEmu',
      data: `An emulator is already running: ${currentGameDetails.name} with ${currentGameDetails.emulatorName}. Please close it before launching a new game.`
    })
    return
  }

  const matchedEmulator = matchEmulatorName(emulatorName, emulators)
  if (matchedEmulator) {
    const retroarchCommandLine = extractRetroarchCommandLine(matchedEmulator)
    logger.log(`fileOperations`, 'Retroarch Command Line:', retroarchCommandLine)
    const retroarchExe = '/Applications/Retroarch.app/Contents/MacOS/RetroArch'
    const libretroCore = `/Users/twoode/Library/Application Support/RetroArch/${retroarchCommandLine}`
    const flagsToEmu = '-v -f'
    currentProcess = spawn(retroarchExe, [outputFile, '-L', libretroCore, ...flagsToEmu.split(' ')])
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

function setTempDir() {
  const tempDir = path.join(process.cwd(), 'temp')
  createDirIfNotExist(tempDir)
  return tempDir
}
