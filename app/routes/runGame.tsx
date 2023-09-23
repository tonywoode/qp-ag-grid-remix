import type { ActionArgs } from '@remix-run/node'
import path from 'path'
import { chooseFittingRom } from '~/utils/goodMergeChooser'
const fs = require('fs').promises
export async function action({ request }: ActionArgs) {
  //you can move the below above here oncce you upgrade remix, top level await will work
  //its an ESM module, use dynamic import inline here, don't try adding it to the serverDependenciesToBundle in remix.config.js, that won't work
  const node7z = await import('node-7z-archive')
  const { extractArchive, onlyArchive, listArchive } = node7z
  const { gamePath, defaultGoodMerge } = await request.json()
  console.log(`recieved from grid`, { gamePath, defaultGoodMerge })
  const gamePathMacOS = path.join(
    //TODO: should be an .env variable with a ui to set (or something on romdata conversation?)
    '/Volumes/Untitled/Games',
    gamePath
      .replace(/^[A-Z]:/, '')
      .split('\\')
      .join('/')
  )
  //   const archivePath = '/Volumes/Untitled/Games/Sega Games/Genesis Games/GoodGEN_3_GM/Atomic Robo-Kid.7z'
  //   const filePathInsideArchive = 'Atomic Robo-Kid (U) [c][!].gen'
  const tempDir = path.join(process.cwd(), 'temp')
  createDirIfNotExist(tempDir)
  const outputDirectory = tempDir

  if (defaultGoodMerge) {
    //meaning row in the grid contains a pre-selected preferred rom to extract
    await onlyArchive(gamePathMacOS, outputDirectory, defaultGoodMerge)
      .then(result => console.log(`7z invoked:`, result))
      .catch(err => console.error(err))
  } else {
    listArchive(gamePathMacOS) //todo: report progress - https://github.com/quentinrossetti/node-7z/issues/104
      .progress(async (files: string[]) => {
        const filenames = files.map(file => file.name)
        console.log(`7z listing: `, filenames)

        //example country code choices
        const countryCodes = ['UK', 'E', 'U']
        const pickedRom = chooseFittingRom(filenames, countryCodes)
        console.log(`computer picked this rom`, pickedRom)
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
