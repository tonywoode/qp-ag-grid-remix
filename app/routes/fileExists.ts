import { fileExists } from '~/utils/fsAccess.server'
import type { LoaderFunction } from '@remix-run/node'
import pathModule from 'path'
import { convertWindowsPathToMacPath } from '~/utils/OSConvert.server'

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url)
  const rawPath = url.searchParams.get('path') || ''
  const macPath = convertWindowsPathToMacPath(rawPath)
  const normalizedPath = pathModule.normalize(macPath)
    console.log('fileExists checking path:', normalizedPath)
  const exists = await fileExists(normalizedPath)
  return new Response(JSON.stringify({ exists }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}