import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { convertPathToOSPath } from '~/utils/OSConvert.server'
import { logger } from '~/root'
import electron from '~/electron.server'
import { join } from 'path'

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const filePath = url.searchParams.get('path')
  logger.log('fileOperations', 'filePath passed to listZip loader', filePath)
  const OSMungedPath = convertPathToOSPath(filePath)
  if (!filePath) {
    return json({ error: 'Path is required' }, { status: 400 })
  }
  try {
    const fileList = await getZipFileList(OSMungedPath)
    return json(fileList)
  } catch (error) {
    console.error('Error unzipping file:', error)
    return json({ error: 'Failed to unzip file' }, { status: 500 })
  }
}

//TODO: basically a straight copy of what's in getTabContent.server.ts
export async function getZipFileList(filePath: string): Promise<string[]> {
  const unpackedPath = electron.app.isPackaged
    ? join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'node-7z-archive', 'lib', 'index.js')
    : 'node-7z-archive' // Use normal path in dev mode
  const node7z = await import(unpackedPath)
  const { listArchive } = node7z
  const filenames: string[] = []
  await new Promise<void>((resolve, reject) => {
    listArchive(filePath)
      .progress(files => {
        filenames.push(...files.map(file => file.name))
      })
      .then(() => resolve())
      .catch(reject)
  })
  return filenames
}
