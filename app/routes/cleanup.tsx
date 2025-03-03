import { json } from '@remix-run/node';
import type { ActionFunctionArgs } from '@remix-run/node';
import { cleanupTempDirectories } from '~/utils/tempManager.server';
import { logger } from '~/root';

export async function action({ request }: ActionFunctionArgs) {
  try {
    const result = await cleanupTempDirectories();
    logger.log('fileOperations', `Manual cleanup: removed ${result.deletedFolders} folders (${result.freedSpaceMB} MB)`);
    return json(result);
  } catch (err) {
    logger.log('fileOperations', `Manual cleanup failed: ${err}`);
    return json({ error: err.message, deletedFolders: 0, freedSpaceMB: 0, totalSizeMB: 0 }, { status: 500 });
  }
}

export default function CleanupRoute() {
  return null; // This route doesn't render anything
}