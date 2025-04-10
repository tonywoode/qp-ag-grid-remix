/*
 ** Created because we get the user's original QP data folder, and write it as json into our appdir's 'data' folder
 ** Hence a few safety measures to try and prevent data loss on the user's machine, to either their own quickplay data
 ** or in extreme circumstances to other data on their machine
 */
import * as fs from 'fs'
import * as path from 'path'
import { dataDirectory, datsDirectory, getTempDirectory, logger } from '~/dataLocations.server'

export type BackupChoice = 'cancel' | 'backup' | 'overwrite'

export async function safeRemoveDirectory(dirPath: string): Promise<void> {
  // Ensure we're not dealing with a symlink
  if (fs.lstatSync(dirPath).isSymbolicLink()) {
    throw new Error('Cannot remove symbolic links for safety reasons')
  }

  // Get absolute paths for comparison
  const resolvedPath = path.resolve(dirPath)
  const resolvedDataDir = path.resolve(dataDirectory)
  const resolvedDatsDir = path.resolve(datsDirectory)
  const resolvedTempDir = path.resolve(getTempDirectory())

  // Only allow removal if the directory is one of our known directories
  // or is a subdirectory of one of those directories
  const isInDataDir = resolvedPath === resolvedDataDir || resolvedPath.startsWith(resolvedDataDir + path.sep)
  const isInDatsDir = resolvedPath === resolvedDatsDir || resolvedPath.startsWith(resolvedDatsDir + path.sep)
  const isInTempDir = resolvedPath === resolvedTempDir || resolvedPath.startsWith(resolvedTempDir + path.sep)

  if (!isInDataDir && !isInDatsDir && !isInTempDir) {
    throw new Error(
      `Cannot remove directory outside of allowed data locations. 
      Path: ${resolvedPath}
      Allowed locations: ${resolvedDataDir}, ${resolvedDatsDir}, ${resolvedTempDir}`
    )
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

export async function backupFile(sourcePath: string): Promise<string> {
  const timestamp = new Date().toISOString().split('.')[0].replace(/[:]/g, '').replace('T', '-')
  const backupPath = `${sourcePath}-backup-${timestamp}`

  await fs.promises.cp(sourcePath, backupPath)
  return backupPath
}

export async function handleExistingFiles(
  files: string[],
  choice: BackupChoice
): Promise<{ success: boolean; backupPaths?: string[] }> {
  switch (choice) {
    case 'cancel':
      return { success: false }

    case 'backup':
      const backupPaths = []
      for (const file of files) {
        if (fs.existsSync(file)) {
          const backupPath = await backupFile(file)
          backupPaths.push(backupPath)
          await fs.promises.unlink(file)
        }
      }
      return { success: true, backupPaths }

    case 'overwrite':
      for (const file of files) {
        if (fs.existsSync(file)) {
          await fs.promises.unlink(file)
        }
      }
      return { success: true }

    default:
      throw new Error('Invalid choice')
  }
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

/**
 * Creates a directory if it doesn't exist, with proper error handling
 * Consider that some people remove all temp dirs on their system, either you can rename your extraction dir, or try this...
 */
export async function createDirIfNotExist(dirPath: string) {
  try {
    const stats = await fs.promises.stat(dirPath)
    if (!stats.isDirectory()) {
      logger.log('fileOperations', `Warning: ${dirPath} exists but is not a directory`)
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      try {
        await fs.promises.mkdir(dirPath, { recursive: true })
        logger.log('fileOperations', `Created directory: ${dirPath}`)
      } catch (mkdirError) {
        logger.log('fileOperations', `Error creating directory ${dirPath}: ${mkdirError}`)
      }
    } else {
      logger.log('fileOperations', `Error accessing directory ${dirPath}: ${error}`)
    }
  }
}
