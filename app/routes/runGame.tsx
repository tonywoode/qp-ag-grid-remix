import type { ActionArgs } from '@remix-run/node'
import path from 'path'
const fs = require('fs').promises

export async function action({ request }: ActionArgs) {
  //you can move the below above here oncce you upgrade remix, top level await will work
  //its an ESM module, use dynamic import inline here, don't try adding it to the serverDependenciesToBundle in remix.config.js, that won't work
  const node7z = await import('node-7z-archive')
  const { extractArchive } = node7z
  const { gamePath, defaultGoodMerge } = await request.json()
  console.log(gamePath, defaultGoodMerge)
  //TODO: this should be a .env variable with a ui to set (or something on romdata conversation?)
  const gamePathMacOS = path.join(
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

  await extractArchive(gamePathMacOS, outputDirectory)
    .then(result => {
      console.log(result)
    })
    .catch(err => {
      console.log(err)
    })
  return null
}

async function createDirIfNotExist(dirPath: string) {
  const fnName = createDirIfNotExist.name
  try {
    const stats = await fs.stat(dirPath)
    if (!stats.isDirectory()) console.log(`${fnName}: Extraction Dir Exists: ${dirPath}`)
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
