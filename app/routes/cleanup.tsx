import { json } from '@remix-run/node'
import type { ActionFunctionArgs } from '@remix-run/node'
import { cleanupTempDirectories } from '~/utils/tempManager.server'
import { logger } from '~/dataLocations.server'

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData()
  const fullCleanup = formData.get('fullCleanup') === 'true'

  try {
    // If fullCleanup is true, pass 0 as maxDays to remove all game folders regardless of age
    const result = await cleanupTempDirectories(fullCleanup ? 0 : undefined)

    if (fullCleanup) {
      logger.log('fileOperations', `Full manual cleanup: removed all game folders (${result.freedSpaceMB} MB)`)
    } else {
      logger.log(
        'fileOperations',
        `Standard manual cleanup: removed ${result.deletedFolders} folders (${result.freedSpaceMB} MB)`
      )
    }

    // Add fullCleanup flag to the result so UI can show appropriate message
    return json({ ...result, fullCleanup })
  } catch (err) {
    logger.log('fileOperations', `Manual cleanup failed: ${err}`)
    return json({ error: err.message, deletedFolders: 0, freedSpaceMB: 0, totalSizeMB: 0 }, { status: 500 })
  }
}

export default function CleanupRoute() {
  return null // This route doesn't render anything
}
