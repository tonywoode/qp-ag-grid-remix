import { json } from '@remix-run/node'
import { fileExists } from '~/utils/fsAccess.server'
import pathModule from 'path'
import { convertWindowsPathToMacPath } from '~/utils/OSConvert.server'

export async function action({ request }) {
  const { paths } = await request.json()
  if (!Array.isArray(paths)) return json({}, { status: 400 })

  const results: Record<string, boolean> = {}
  const checks = paths.map(async p => {
    const macPath = convertWindowsPathToMacPath(p)
    const normalizedPath = pathModule.normalize(macPath)
    const exists = await fileExists(normalizedPath)
    return { path: p, exists }
  })

  const resultsArr = await Promise.all(checks)
  resultsArr.forEach(item => {
    results[item.path] = item.exists
  })
  return json({ results })
}