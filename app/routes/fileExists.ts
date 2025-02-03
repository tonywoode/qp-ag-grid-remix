import { fileExists } from '~/utils/fsAccess.server'
import type { LoaderFunction } from '@remix-run/node'
import pathModule from 'path'
import { convertPathToOSPath } from '~/utils/OSConvert.server'

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url)
  const rawPath = url.searchParams.get('path') || ''
  const OSMungedPath = convertPathToOSPath(rawPath)
  const normalizedPath = pathModule.normalize(OSMungedPath)
  console.log('fileExists checking path:', normalizedPath)
  const exists = await fileExists(normalizedPath)
  return new Response(JSON.stringify({ exists }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}