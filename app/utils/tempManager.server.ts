import fs from 'fs';
import path from 'path';
import { getTempDirectory } from '~/dataLocations.server';
import { createDirIfNotExist, safeRemoveDirectory } from '~/utils/safeDirectoryOps.server'
import { logger } from '../root';

// Settings that could eventually be user-configurable
const DEFAULT_MAX_AGE_DAYS = 14; // Default: Delete after 2 weeks of no use
const DEFAULT_MAX_TEMP_SIZE_MB = 10000; // Default: 10GB max temp size

/**
 * Get archive-specific extraction directory path.
 * Creates a folder based on the archive name within the temp directory
 * TODO: fix the windows-max-path issue: if we go over the char limit, change to 8:3 naming or ewquivalent
 */
export async function getArchiveExtractionDir(archivePath: string, system: string): Promise<string> {
  const baseDir = getTempDirectory()
  await createDirIfNotExist(baseDir)

  // Create system directory if needed
  const systemDir = path.join(baseDir, system)
  await createDirIfNotExist(systemDir)

  // Use the filename WITHOUT extension as the extraction folder name
  const archiveBasename = path.basename(archivePath, path.extname(archivePath))
  // Replace any invalid characters in the folder name - this shouldnt be necessary its always a filename?
  const safeFolderName = archiveBasename.replace(/[<>:"/\\|?*]/g, '_')

  const extractionDir = path.join(systemDir, safeFolderName)
  await createDirIfNotExist(extractionDir)

  return extractionDir
}

/**
 * Update the directory's timestamps to mark it as recently used
 */
export function touchExtractionDir(dirPath: string): void {
  try {
    const now = new Date()
    // Update both access time and modification time to now
    fs.utimesSync(dirPath, now, now)
    logger.log('fileOperations', `Updated timestamps for ${dirPath}`)
  } catch (err) {
    logger.log('fileOperations', `Could not update timestamps: ${err}`)
  }
}

/**
 * Check if an extraction already exists and is valid
 * @param extractionDir - The directory where files should be extracted
 * @param expectedFiles - Either a single filename or an array of file info objects with name and size
 */
export async function verifyExtraction(
  extractionDir: string,
  expectedFiles: string | { name: string; size: number }[] | null = null
): Promise<boolean> {
  try {
    // Check if directory exists
    if (!fs.existsSync(extractionDir)) return false

    // Check for a specific file (string case)
    if (typeof expectedFiles === 'string') {
      const filePath = path.join(extractionDir, expectedFiles)
      if (!fs.existsSync(filePath)) return false
    } 
    // Check for multiple files with size verification
    else if (Array.isArray(expectedFiles) && expectedFiles.length > 0) {
      // Check that all expected files exist and have the correct size
      for (const fileInfo of expectedFiles) {
        const filePath = path.join(extractionDir, fileInfo.name)
        
        // File doesn't exist
        if (!fs.existsSync(filePath)) {
          logger.log('fileOperations', `Missing file during verification: ${fileInfo.name}`)
          return false
        }
        
        // Get actual file size
        const stats = fs.statSync(filePath)
        
        // Allow for a small tolerance in file size comparison (to handle potential differences
        // between how 7z reports sizes vs actual filesystem sizes)
        const sizeTolerance = 128  // bytes of tolerance
        const sizeDifference = Math.abs(stats.size - fileInfo.size)
        
        if (sizeDifference > sizeTolerance) {
          logger.log(
            'fileOperations', 
            `Size mismatch for ${fileInfo.name}: expected ${fileInfo.size}, got ${stats.size}`
          )
          return false
        }
      }
    } else {
      // Otherwise make sure directory isn't empty (fallback case)
      const files = fs.readdirSync(extractionDir)
      if (files.length === 0) return false
    }

    // If we got here, the extraction exists and seems valid
    // Touch the directory to update its timestamp
    touchExtractionDir(extractionDir)
    return true
  } catch (err) {
    logger.log('fileOperations', `Error verifying extraction: ${err}`)
    return false
  }
}

/**
 * Clean up old extraction folders based on age and size limits
 */
export async function cleanupTempDirectories(
  maxAgeDays: number = DEFAULT_MAX_AGE_DAYS,
  maxSizeMB: number = DEFAULT_MAX_TEMP_SIZE_MB
): Promise<{
  deletedFolders: number
  freedSpaceMB: number
  totalSizeMB: number
}> {
  const tempDir = getTempDirectory()
  let deletedFolders = 0
  let freedSpaceMB = 0

  try {
    // Skip if temp dir doesn't exist
    if (!fs.existsSync(tempDir)) {
      return { deletedFolders: 0, freedSpaceMB: 0, totalSizeMB: 0 }
    }

    // Get all system directories
    const systemFolders = fs
      .readdirSync(tempDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)

    // Track folder info for cleanup
    const folderData = []

    // First pass: gather info about all game folders across all systems
    for (const system of systemFolders) {
      const systemPath = path.join(tempDir, system)

      try {
        const gameFolders = fs
          .readdirSync(systemPath, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name)

        for (const gameFolder of gameFolders) {
          try {
            const folderPath = path.join(systemPath, gameFolder)
            const stats = fs.statSync(folderPath)

            // Calculate folder size
            let sizeBytes = 0
            const files = fs.readdirSync(folderPath)
            for (const file of files) {
              try {
                const fileStats = fs.statSync(path.join(folderPath, file))
                sizeBytes += fileStats.size
              } catch (err) {
                logger.log('fileOperations', `Error getting file stats for ${file}: ${err}`)
              }
            }

            // Use mtime as our "last used" indicator
            folderData.push({
              system,
              folder: gameFolder,
              folderPath,
              lastUsed: stats.mtime,
              sizeBytes
            })
          } catch (err) {
            logger.log('fileOperations', `Error processing folder ${gameFolder}: ${err}`)
          }
        }
      } catch (err) {
        logger.log('fileOperations', `Error reading system directory ${system}: ${err}`)
      }
    }

    // Calculate total size
    const totalSizeBytes = folderData.reduce((acc, data) => acc + data.sizeBytes, 0)
    const totalSizeMB = totalSizeBytes / (1024 * 1024)

    // First cleanup: remove old files by time
    const now = new Date()
    const oldFolders = folderData.filter(data => {
      const ageMs = now.getTime() - data.lastUsed.getTime()
      const ageDays = ageMs / (24 * 60 * 60 * 1000)
      return ageDays > maxAgeDays
    })

    // Delete old folders
    for (const { system, folder, folderPath, sizeBytes } of oldFolders) {
      try {
        // Use the safeRemoveDirectory function instead of fs.rmSync directly
        await safeRemoveDirectory(folderPath)
        logger.log(
          'fileOperations',
          `Deleted old extraction folder: ${system}/${folder} (unused for > ${maxAgeDays} days)`
        )
        deletedFolders++
        freedSpaceMB += sizeBytes / (1024 * 1024)

        // Check if system folder is now empty and remove it if so
        const systemPath = path.join(tempDir, system)
        if (fs.existsSync(systemPath) && fs.readdirSync(systemPath).length === 0) {
          await safeRemoveDirectory(systemPath)
          logger.log('fileOperations', `Removed empty system folder: ${system}`)
        }
      } catch (err) {
        logger.log('fileOperations', `Failed to delete folder ${system}/${folder}: ${err}`)
      }
    }

    // If we're still over size limit, remove least recently used folders until under limit
    if (totalSizeMB > maxSizeMB) {
      // Sort by last used (oldest first)
      const sortedByAge = folderData
        .filter(data => !oldFolders.some(old => old.system === data.system && old.folder === data.folder)) // Remove already deleted
        .sort((a, b) => a.lastUsed.getTime() - b.lastUsed.getTime())

      let currentSize = totalSizeMB

      for (const { system, folder, folderPath, sizeBytes } of sortedByAge) {
        // Stop if we're under the limit
        if (currentSize <= maxSizeMB) break

        try {
          await safeRemoveDirectory(folderPath)
          logger.log('fileOperations', `Deleted least recently used folder: ${system}/${folder} (space management)`)

          // Update running size
          const sizeMB = sizeBytes / (1024 * 1024)
          currentSize -= sizeMB
          deletedFolders++
          freedSpaceMB += sizeMB

          // Check if system folder is now empty and remove it if so
          const systemPath = path.join(tempDir, system)
          if (fs.existsSync(systemPath) && fs.readdirSync(systemPath).length === 0) {
            await safeRemoveDirectory(systemPath)
            logger.log('fileOperations', `Removed empty system folder: ${system}`)
          }
        } catch (err) {
          logger.log('fileOperations', `Failed to delete folder ${system}/${folder}: ${err}`)
        }
      }
    }

    return {
      deletedFolders,
      freedSpaceMB: Math.round(freedSpaceMB),
      totalSizeMB: Math.round(totalSizeMB - freedSpaceMB)
    }
  } catch (err) {
    logger.log('fileOperations', `Error during temp directory cleanup: ${err}`)
    return { deletedFolders: 0, freedSpaceMB: 0, totalSizeMB: 0 }
  }
}