import { execSync } from 'child_process'
import type { ActionFunctionArgs } from '@remix-run/node'
import path from 'path'
import { chooseGoodMergeRom } from '~/utils/goodMergeChooser'
import { createDirIfNotExist } from '../utils/createDirIfNotExist'
import { logger } from '../root'
import emulators from '~/../dats/emulators.json'
import { convertWindowsPathToMacPath } from '~/utils/OSConvert.server'

export async function action({ request }: ActionFunctionArgs) {
  const { gamePath, fileInZipToRun, emulatorName } = await request.json()
  logger.log(`fileOperations`, `runGame received from grid`, { gamePath, fileInZipToRun, emulatorName })
  //TODO: should be an .env variable with a ui to set (or something on romdata conversation?)
  const gamePathMacOS = convertWindowsPathToMacPath(gamePath)
  const outputDirectory = setTempDir()
  const gameExtension = path.extname(gamePathMacOS)
  if (gameExtension === '.7z') {
    //TODO: sadly this isn't good enough, look at saturn games
    //But it IS a good shortcut, we DO know if its not a 7z that we don't have a goodmerge set, so we can skip checking, but we can't just run a game, what if its some other file that needs uncompressing
    await examine7z(gamePathMacOS, outputDirectory, fileInZipToRun, emulatorName)
  } else {
    await runGame(gamePathMacOS, emulatorName)
  }
  return null
}

async function examine7z(gamePathMacOS, outputDirectory, fileInZipToRun, emulatorName) {
  //you can move the below above here once you upgrade remix, top level await will work
  //its an ESM module, use dynamic import inline here, don't try adding it to the serverDependenciesToBundle in remix.config.js, that won't work
  const { onlyArchive, listArchive } = await import('node-7z-archive')
  if (fileInZipToRun) {
    //meaning row in the grid contains a pre-selected preferred rom to extract
    await extractSingleRom(gamePathMacOS, outputDirectory, fileInZipToRun, onlyArchive, logger)
    const outputFile = path.join(outputDirectory, fileInZipToRun)
    runGame(outputFile, emulatorName)
  } else {
    logger.log(`fileOperations`, 'listing archive', gamePathMacOS)
    listArchive(gamePathMacOS) //todo: report progress - https://github.com/quentinrossetti/node-7z/issues/104
      .progress(async (files: string[]) => {
        //if its a disk image type, we know we need to extract the whole thing, and pick the right runnable file to pass to the emu
        const diskImageExtensions = ['.iso', '.bin', '.cue', '.ccd', '.img', '.mdf', '.nrg', '.chd']

        const filenames = files.map(file => file.name)
        logger.log(`fileOperations`, `7z listing: `, filenames)
        const pickedRom = setupChooseGoodMergeRom(filenames, logger)
        logger.log(`goodMergeChoosing`, `computer picked this rom:`, pickedRom)

        await extractSingleRom(gamePathMacOS, outputDirectory, pickedRom, onlyArchive, logger)
        const outputFile = path.join(outputDirectory, pickedRom)
        await runGame(outputFile, emulatorName)

        return files //this seems to have no effect see https://github.com/cujojs/when/blob/HEAD/docs/api.md#progress-events-are-deprecated
      })
      .then(archivePathsSpec => logger.log(`fileOperations`, `listed this archive: `, archivePathsSpec))
      .catch(err => console.error('error listing archive: ', err))
  }
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
  await onlyArchive(gamePath, outputDirectory, romInArchive)
    .then(result => logger.log(`fileOperations`, `extracting with 7z:`, result))
    .catch(err => console.error(err))
}

async function runGame(outputFile: string, emulatorName: string) {
  const matchedEmulator = matchEmulatorName(emulatorName, emulators)
  if (matchedEmulator) {
    const retroarchCommandLine = extractRetroarchCommandLine(matchedEmulator)
    logger.log(`fileOperations`, 'Retroarch Command Line:', retroarchCommandLine)
    //sigh a problem with the data here: "emulatorName": "RetroArch Nintendo Gamecube Multiloader (Dolphin)",
    const retroarchExe = '/Applications/Retroarch.app/Contents/MacOS/RetroArch'
    const libretroCore = `/Users/twoode/Library/Application Support/RetroArch/${retroarchCommandLine}`
    const flagsToEmu = '-v -f'
    const command = `"${retroarchExe}" "${outputFile}" -L "${libretroCore}" ${flagsToEmu}`
    try {
      const output = await execSync(command) // Execute synchronously, remember spawnSync too
      logger.log(`fileOperations`, `Output: ${output}`)
    } catch (error) {
      console.error(`Error executing command: ${error}`)
    }
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
