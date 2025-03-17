import fs from 'fs'
import path from 'path'
import { logger } from '~/dataLocations.server'

// TEMPORARY SOLUTION FOR TESTING - This allows end users to customize certain paths
// without modifying the codebase. A more robust settings system should replace this.

// Default to empty paths - will fall back to hardcoded paths if not overridden
const defaultUserPaths = {
  mameExtras: ''  // If empty, will use the systemPaths.mameExtras path
}

// Simple function to load user paths from a JSON file
// In the same directory as the executable, they create a file named user-paths.json
//The file content would look like:
//{
//    "mameExtras": "C:/Path/To/Their/MAME/EXTRAs/icons"
//}

export function loadUserPaths() {
  try {
    // Look for user-paths.json in the app's root directory
    const userPathsFile = path.join(process.cwd(), 'user-paths.json')
    
    if (fs.existsSync(userPathsFile)) {
      const data = fs.readFileSync(userPathsFile, 'utf8')
      const userPaths = JSON.parse(data)
      logger.log('config', `TEMP CONFIG: Loaded user paths from ${userPathsFile}`)
      return { ...defaultUserPaths, ...userPaths }
    }
  } catch (error) {
    logger.log('config', `Error loading user paths: ${error}`)
  }
  
  // If file doesn't exist or there's an error, return defaults
  return defaultUserPaths
}

// Export the user paths
export const userPaths = loadUserPaths()