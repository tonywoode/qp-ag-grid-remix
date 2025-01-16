
import { json } from '@remix-run/node'
import { fileExists } from '~/utils/fsAccess.server'
import pathModule from 'path'
import { convertWindowsPathToMacPath } from '~/utils/OSConvert.server'

export async function action({ request }) {
  const { paths } = await request.json()
  if (!Array.isArray(paths)) return json({}, { status: 400 })

  const results: Record<string, boolean> = {}
  for await (const p of paths) {
    const macPath = convertWindowsPathToMacPath(p)
    const normalizedPath = pathModule.normalize(macPath)
    const exists = await fileExists(normalizedPath)
    results[p] = exists
  }
  return json({ results })
}