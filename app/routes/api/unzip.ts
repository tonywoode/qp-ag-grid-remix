import { json } from '@remix-run/node'
import { getZipFileList } from '~/getTabContent.server'

export async function action({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const filePath = url.searchParams.get('path')
  if (!filePath) {
    return json({ error: 'Path is required' }, { status: 400 })
  }
  try {
    const fileList = await getZipFileList(filePath)
    return json(fileList)
  } catch (error) {
    console.error('Error unzipping file:', error)
    return json({ error: 'Failed to unzip file' }, { status: 500 })
  }
}
