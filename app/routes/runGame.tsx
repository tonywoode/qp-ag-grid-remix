import type { ActionArgs } from '@remix-run/node'
import path from 'path'
import { chooseGoodMergeRom } from '~/utils/goodMergeChooser'
const fs = require('fs').promises
export async function action({ request }: ActionArgs) {
  //you can move the below above here once you upgrade remix, top level await will work
  //its an ESM module, use dynamic import inline here, don't try adding it to the serverDependenciesToBundle in remix.config.js, that won't work
  const node7z = await import('node-7z-archive')
  const { extractArchive, onlyArchive, listArchive } = node7z
  const { gamePath, defaultGoodMerge } = await request.json()
  console.log(`recieved from grid`, { gamePath, defaultGoodMerge })
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
        if (filenames.length === 1) {
          extractRom(gamePathMacOS, outputDirectory, filenames[0])
          return
        }
        //example country code choices, TODO: type this well; invert numbering, make fallbacks clearer, link to goodmerge doc
        //this needs a file of its own, the country codes in the goodmerge doc don't marry up with those in the wild, eg: w for world in genesis
        const fallbackCountryCodes = { PD: 1, Unl: 2, Unk: 3 } // would rather get these than wrong language
        //world actually prob means there's only one country code in the rom?
        const countryCodePrefs = { B: 4, A: 5, 4: 6, U: 7, W: 8, E: 9, UK: 10 }
        const countryCodes = { ...fallbackCountryCodes, ...countryCodePrefs }
        console.log(`sending country code choices to GoodMerge chooser`, countryCodes)
        const pickedRom = chooseGoodMergeRom(filenames, countryCodes)
        console.log(`computer picked this rom:`, pickedRom)
        //unarchive the picked rom
        // onlyArchive(gamePathMacOS, outputDirectory, pickedRom)
        //   .then(result => {
        //     console.log(result)
        //   })
        //   .catch(err => {
        //     console.log(err)
        //   })

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
/**
 * Consider that some people remove all temp dirs on their system, either you can rename your extraction dir, or try this...
 */
async function createDirIfNotExist(dirPath: string) {
  const fnName = createDirIfNotExist.name
  try {
    const stats = await fs.stat(dirPath)
    if (stats.isDirectory()) console.log(`extraction Dir: ${dirPath}`)
    else console.error(`${fnName}: ${dirPath} exists but is not a dir`)
  } catch (error) {
    if (error.code === 'ENOENT') {
      try {
        await fs.mkdir(dirPath, { recursive: true })
        console.log(`${fnName}: Dir ${dirPath} didn't preexist: created successfully`)
      } catch (mkdirError) {
        console.error(`${fnName}: Error creating dir: ${mkdirError}`)
      }
    } else console.error(`${fnName}: Error accessing dir: ${error}`)
  }
}
