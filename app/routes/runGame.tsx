import type { ActionArgs } from '@remix-run/node'
import path from 'path'
import { chooseGoodMergeRom } from '~/utils/goodMergeChooser'
import { createDirIfNotExist } from '../utils/createDirIfNotExist'
import { logger } from './_index'
export async function action({ request }: ActionArgs) {
  //you can move the below above here once you upgrade remix, top level await will work
  //its an ESM module, use dynamic import inline here, don't try adding it to the serverDependenciesToBundle in remix.config.js, that won't work
  const node7z = await import('node-7z-archive')
  const { onlyArchive, listArchive } = node7z
  const { gamePath, defaultGoodMerge } = await request.json()
  console.log(`received from grid`, { gamePath, defaultGoodMerge })
  const gamePathMacOS = path.join(
    //TODO: should be an .env variable with a ui to set (or something on romdata conversation?)
    '/Volumes/Untitled/Games',
    gamePath.replace(/^[A-Z]:/, '').split('\\').join('/') // prettier-ignore
  )
  //   const archivePath = '/Volumes/Untitled/Games/Sega Games/Genesis Games/GoodGEN_3_GM/Atomic Robo-Kid.7z'
  //   const filePathInsideArchive = 'Atomic Robo-Kid (U) [c][!].gen'
  const tempDir = path.join(process.cwd(), 'temp')
  createDirIfNotExist(tempDir)
  const outputDirectory = tempDir

  if (defaultGoodMerge) {
    //meaning row in the grid contains a pre-selected preferred rom to extract
    await extractRom(gamePathMacOS, outputDirectory, defaultGoodMerge)
  } else {
    listArchive(gamePathMacOS) //todo: report progress - https://github.com/quentinrossetti/node-7z/issues/104
      .progress(async (files: string[]) => {
        const filenames = files.map(file => file.name)
        console.log(`7z listing: `, filenames)
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

        extractRom(gamePathMacOS, outputDirectory, pickedRom)

        return files //this seems to have no effect see https://github.com/cujojs/when/blob/HEAD/docs/api.md#progress-events-are-deprecated
      })
      .then(archivePathsSpec => {
        console.log('listed this archive: ', archivePathsSpec)
      })
      .catch(err => {
        console.log('error listing archive: ', err)
      })
  }
  return null

  async function extractRom(gamePath, outputDirectory, romInArchive) {
    await onlyArchive(gamePath, outputDirectory, romInArchive)
      .then(result => console.log(`7z invoked:`, result))
      .catch(err => console.error(err))
  }
}

