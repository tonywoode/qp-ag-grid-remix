import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { convertPathToOSPath } from '~/utils/OSConvert.server'
import { logger } from '~/root'

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
  const node7z = await import('node-7z-archive')
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
