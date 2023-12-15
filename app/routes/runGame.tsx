import { execSync } from 'child_process'
import type { ActionArgs } from '@remix-run/node'
import path from 'path'
import { chooseGoodMergeRom } from '~/utils/goodMergeChooser'
import { createDirIfNotExist } from '../utils/createDirIfNotExist'
import { logger } from '../root'
import emulators from '~/../dats/emulators.json'

export async function action({ request }: ActionArgs) {
  //you can move the below above here once you upgrade remix, top level await will work
  //its an ESM module, use dynamic import inline here, don't try adding it to the serverDependenciesToBundle in remix.config.js, that won't work
  const node7z = await import('node-7z-archive')
  const { onlyArchive, listArchive } = node7z
  const { gamePath, defaultGoodMerge, emulatorName } = await request.json()
  logger.log(`gridOperations`, `received from grid`, { gamePath, defaultGoodMerge, emulatorName })

  const macOSGamesDirPath = '/Volumes/Untitled/Games'
  const gamesDirReplacedPath = path.join(
    //TODO: should be an .env variable with a ui to set (or something on romdata conversation?)
    gamePath.replace(/^\{gamesDir\}/, macOSGamesDirPath)
  )
  const gamePathMacOS = path.normalize(gamesDirReplacedPath).replace(/\\/g, '/') //TODO: is the replace really required?

  // const gamePathMacOS = path.join(
  //   '/Volumes/Untitled/Games',
  //   gamePath.replace(/^[A-Z]:/, '').split('\\').join('/') // prettier-ignore
  // )
  //   const archivePath = '/Volumes/Untitled/Games/Sega Games/Genesis Games/GoodGEN_3_GM/Atomic Robo-Kid.7z'
  //   const filePathInsideArchive = 'Atomic Robo-Kid (U) [c][!].gen'
  const tempDir = path.join(process.cwd(), 'temp')
  createDirIfNotExist(tempDir)
  const outputDirectory = tempDir

  const gameExtension = path.extname(gamePathMacOS)
  if (gameExtension === '.7z') {
    //TODO: sadly this isn't good enough, look at saturn games
    await examine7z(gamePathMacOS, outputDirectory, defaultGoodMerge, emulatorName)
  } else {
    await runGame(gamePathMacOS)
  }

  async function examine7z(gamePathMacOS, outputDirectory, defaultGoodMerge, emulatorName) {
    if (defaultGoodMerge) {
      //meaning row in the grid contains a pre-selected preferred rom to extract
      await extractRom(gamePathMacOS, outputDirectory, defaultGoodMerge, logger)
      const outputFile = path.join(outputDirectory, defaultGoodMerge)
      runGame(outputFile)
    } else {
      console.log('listing archive', gamePathMacOS)
      listArchive(gamePathMacOS) //todo: report progress - https://github.com/quentinrossetti/node-7z/issues/104
        .progress(async (files: string[]) => {
          const filenames = files.map(file => file.name)
          logger.log(`fileOperations`, `7z listing: `, filenames)
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
          const pickedRom = chooseGoodMergeRom(filenames, countryCodes, priorityCodes, logger)
          logger.log(`goodMergeChoosing`, `computer picked this rom:`, pickedRom)

          await extractRom(gamePathMacOS, outputDirectory, pickedRom, logger)
          const outputFile = path.join(outputDirectory, pickedRom)
          await runGame(outputFile)

          return files //this seems to have no effect see https://github.com/cujojs/when/blob/HEAD/docs/api.md#progress-events-are-deprecated
        })
        .then(archivePathsSpec => logger.log(`fileOperations`, `listed this archive: `, archivePathsSpec))
        .catch(err => console.error('error listing archive: ', err))
    }
  }
  return null

  async function extractRom(gamePath, outputDirectory, romInArchive, logger) {
    await onlyArchive(gamePath, outputDirectory, romInArchive)
      .then(result => logger.log(`fileOperations`, `extracting with 7z:`, result))
      .catch(err => console.error(err))
  }

  async function runGame(outputFile: string) {
    const matchedEmulator = matchEmulatorName(emulatorName, emulators)
    if (matchedEmulator) {
      const retroarchCommandLine = extractRetroarchCommandLine(matchedEmulator)
      console.log('Retroarch Command Line:', retroarchCommandLine)
      //sigh a problem with the data here: "emulatorName": "RetroArch Nintendo Gamecube Multiloader (Dolphin)",
      const retroarchExe = '/Applications/Retroarch.app/Contents/MacOS/RetroArch'
      const libretroCore = `/Users/twoode/Library/Application Support/RetroArch/${retroarchCommandLine}`
      const flagsToEmu = '-v -f'
      const command = `"${retroarchExe}" "${outputFile}" -L "${libretroCore}" ${flagsToEmu}`
      try {
        const output = await execSync(command) // Execute synchronously, remember spawnSync too
        console.log(`Output: ${output}`)
      } catch (error) {
        console.error(`Error executing command: ${error}`)
      }
    } else {
      console.log('Emulator not found')
    }
  }

  function matchEmulatorName(emulatorName, emulators) {
    return emulators.find(emulator => emulator.emulatorName === emulatorName)
  }

  function extractRetroarchCommandLine(emulatorJson) {
    const { parameters } = emulatorJson
    const libretroCoreMatch = parameters.match(/cores[^ ]+/)

    if (libretroCoreMatch) {
      console.log('libretroCoreMatch', libretroCoreMatch)
      const libretroCorePath = libretroCoreMatch[0].replace(/\\/g, '/').replace(/"/g, '') //TODO: try loading a GC game without the " removal!
      console.log('libretroCorePath', libretroCorePath)
      return libretroCorePath.replace(/\.dll$/, '.dylib')
    } else {
      return 'No libretro core found in parameters string' //TODO: don't return a string as an error
    }
  }
}
