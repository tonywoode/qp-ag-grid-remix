/*
 ** Created because we get the user's original QP data folder, and write it as json into our appdir's 'data' folder
 ** Hence a few safety measures to try and prevent data loss on the user's machine, to either their own quickplay data
 ** or in extreme circumstances to other data on their machine
 */
import * as fs from 'fs'
import * as path from 'path'

export type BackupChoice = 'cancel' | 'backup' | 'overwrite'

export async function safeRemoveDirectory(dirPath: string): Promise<void> {
  //ensure we're not dealing with a symlink
  if (fs.lstatSync(dirPath).isSymbolicLink()) {
    throw new Error('Cannot remove symbolic links for safety reasons')
  }

  //verify the path is within our app directory
  const appDir = process.cwd()
  const resolvedPath = path.resolve(dirPath)
  if (!resolvedPath.startsWith(appDir)) {
    throw new Error('Cannot remove directories outside the app directory')
  }

  await fs.promises.rm(dirPath, { recursive: true, force: true })
}

export async function backupDirectory(sourcePath: string): Promise<string> {
  const timestamp = new Date().toISOString().split('.')[0].replace(/[:]/g, '').replace('T', '-')
  const backupPath = `${sourcePath}-backup-${timestamp}`

  //copy directory recursively
  await fs.promises.cp(sourcePath, backupPath, { recursive: true })
  return backupPath
}

export async function handleExistingData(
  destPath: string,
  choice: BackupChoice
): Promise<{ success: boolean; backupPath?: string }> {
  switch (choice) {
    case 'cancel':
      return { success: false }

    case 'backup':
      const backupPath = await backupDirectory(destPath)
      await safeRemoveDirectory(destPath)
      return { success: true, backupPath }

    case 'overwrite':
      await safeRemoveDirectory(destPath)
      return { success: true }

    default:
      throw new Error('Invalid choice')
  }
}
