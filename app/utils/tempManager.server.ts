import fs from 'fs';
import path from 'path';
import { getTempDirectory } from '~/dataLocations.server';
import { createDirIfNotExist } from '~/utils/safeDirectoryOps.server';
import { logger } from '../root';

// Settings that could eventually be user-configurable
const DEFAULT_MAX_AGE_DAYS = 14; // Default: Delete after 2 weeks of no use
const DEFAULT_MAX_TEMP_SIZE_MB = 10000; // Default: 10GB max temp size

/**
 * Get archive-specific extraction directory path.
 * Creates a folder based on the archive name within the temp directory
 * TODO: fix the windows-max-path issue: if we go over the char limit, change to 8:3 naming or ewquivalent
 */
export async function getArchiveExtractionDir(archivePath: string): Promise<string> {
  const baseDir = getTempDirectory();
  await createDirIfNotExist(baseDir);
  
  // Use the filename (without path) as the extraction folder name
  const archiveBasename = path.basename(archivePath);
  // Replace any invalid characters in the folder name
  const safeFolderName = archiveBasename.replace(/[<>:"/\\|?*]/g, '_');
  
  const extractionDir = path.join(baseDir, safeFolderName);
  await createDirIfNotExist(extractionDir);
  
  return extractionDir;
}

/**
 * Update the directory's timestamps to mark it as recently used
 */
export function touchExtractionDir(dirPath: string): void {
  try {
    const now = new Date();
    // Update both access time and modification time to now
    fs.utimesSync(dirPath, now, now);
    logger.log('fileOperations', `Updated timestamps for ${dirPath}`);
  } catch (err) {
    logger.log('fileOperations', `Could not update timestamps: ${err}`);
  }
}

/**
 * Check if an extraction already exists and is valid
 */
export async function verifyExtraction(
  extractionDir: string, 
  expectedFile: string | null = null
): Promise<boolean> {
  try {
    // Check if directory exists
    if (!fs.existsSync(extractionDir)) return false;
    
    // If we're looking for a specific file, check if it exists
    if (expectedFile) {
      const filePath = path.join(extractionDir, expectedFile);
      if (!fs.existsSync(filePath)) return false;
    } else {
      // Otherwise make sure directory isn't empty
      const files = fs.readdirSync(extractionDir);
      if (files.length === 0) return false;
    }
    
    // If we got here, the extraction exists and seems valid
    // Touch the directory to update its timestamp
    touchExtractionDir(extractionDir);
    return true;
  } catch (err) {
    logger.log('fileOperations', `Error verifying extraction: ${err}`);
    return false;
  }
}

/**
 * Clean up old extraction folders based on age and size limits
 */
export async function cleanupTempDirectories(
  maxAgeDays: number = DEFAULT_MAX_AGE_DAYS,
  maxSizeMB: number = DEFAULT_MAX_TEMP_SIZE_MB
): Promise<{
  deletedFolders: number;
  freedSpaceMB: number;
  totalSizeMB: number;
}> {
  const tempDir = getTempDirectory();
  let deletedFolders = 0;
  let freedSpaceMB = 0;
  
  try {
    // Skip if temp dir doesn't exist
    if (!fs.existsSync(tempDir)) {
      return { deletedFolders: 0, freedSpaceMB: 0, totalSizeMB: 0 };
    }
    
    // Get all subdirectories
    const extractionFolders = fs.readdirSync(tempDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    // Track folder info for cleanup
    const folderData = [];
    
    // First pass: gather info about all folders
    for (const folder of extractionFolders) {
      try {
        const folderPath = path.join(tempDir, folder);
        const stats = fs.statSync(folderPath);
        
        // Calculate folder size
        let sizeBytes = 0;
        const files = fs.readdirSync(folderPath);
        for (const file of files) {
          try {
            const fileStats = fs.statSync(path.join(folderPath, file));
            sizeBytes += fileStats.size;
          } catch (err) {
            logger.log('fileOperations', `Error getting file stats for ${file}: ${err}`);
          }
        }
        
        // Use mtime as our "last used" indicator
        folderData.push({ 
          folder, 
          folderPath,
          lastUsed: stats.mtime, 
          sizeBytes 
        });
      } catch (err) {
        logger.log('fileOperations', `Error processing folder ${folder}: ${err}`);
      }
    }
    
    // Calculate total size
    const totalSizeBytes = folderData.reduce((acc, data) => acc + data.sizeBytes, 0);
    const totalSizeMB = totalSizeBytes / (1024 * 1024);
    
    // First cleanup: remove old files by time
    const now = new Date();
    const oldFolders = folderData.filter(data => {
      const ageMs = now.getTime() - data.lastUsed.getTime();
      const ageDays = ageMs / (24 * 60 * 60 * 1000);
      return ageDays > maxAgeDays;
    });
    
    // Delete old folders
    for (const { folder, folderPath, sizeBytes } of oldFolders) {
      try {
        // fs.rmSync(folderPath, { recursive: true, force: true });
        //shouldn't it be safeRemoveDirectory from safeDirectoryOps.server.ts?
        console.log('Jeez i was just about to run fs.rmSync recursively on this folder: ', folderPath)
        logger.log('fileOperations', `Deleted old extraction folder: ${folder} (unused for > ${maxAgeDays} days)`);
        deletedFolders++;
        freedSpaceMB += sizeBytes / (1024 * 1024);
      } catch (err) {
        logger.log('fileOperations', `Failed to delete folder ${folder}: ${err}`);
      }
    }
    
    // If we're still over size limit, remove least recently used folders until under limit
    if (totalSizeMB > maxSizeMB) {
      // Sort by last used (oldest first)
      const sortedByAge = folderData
        .filter(data => !oldFolders.some(old => old.folder === data.folder)) // Remove already deleted
        .sort((a, b) => a.lastUsed.getTime() - b.lastUsed.getTime());
      
      let currentSize = totalSizeMB;
      
      for (const { folder, folderPath, sizeBytes } of sortedByAge) {
        // Stop if we're under the limit
        if (currentSize <= maxSizeMB) break;
        
        try {
          fs.rmSync(folderPath, { recursive: true, force: true });
          logger.log('fileOperations', `Deleted least recently used folder: ${folder} (space management)`);
          
          // Update running size
          const sizeMB = sizeBytes / (1024 * 1024);
          currentSize -= sizeMB;
          deletedFolders++;
          freedSpaceMB += sizeMB;
        } catch (err) {
          logger.log('fileOperations', `Failed to delete folder ${folder}: ${err}`);
        }
      }
    }
    
    return { 
      deletedFolders, 
      freedSpaceMB: Math.round(freedSpaceMB), 
      totalSizeMB: Math.round(totalSizeMB - freedSpaceMB)
    };
  } catch (err) {
    logger.log('fileOperations', `Error during temp directory cleanup: ${err}`);
    return { deletedFolders: 0, freedSpaceMB: 0, totalSizeMB: 0 };
  }
}