import fs from 'fs'
import path from 'path'
import os from 'os'
import electron from '~/electron.server'
import { createFeatureLogger } from '~/utils/featureLogger'

// Get the appropriate base directory depending on environment and platform
const getBaseDirectory = () => {
  // In development, use the project root directory
  if (process.env.NODE_ENV === 'development') {
    return path.join(__dirname, '..')
  }

  // In production, platform-specific paths
  if (process.platform === 'darwin') {
    // On macOS, use the user data directory (typically ~/Library/Application Support/[App Name]/)
    return electron.app.getPath('userData')
  } else {
    // On Windows and other platforms, use the directory containing the executable
    return path.dirname(electron.app.getPath('exe'))
  }
}

// Define the temp directory location based on platform
const getTempDirectory = () => {
  if (process.env.NODE_ENV === 'development') {
    // In development, use a local temp directory
    return path.join(getBaseDirectory(), 'temp')
  }

  if (process.platform === 'darwin') {
    // On macOS, use ~/Library/Caches/[App Name]/temp
    const homeDir = os.homedir()
    return path.join(homeDir, 'Library', 'Caches', electron.app.getName(), 'temp')
  } else {
    // On Windows, keep temp next to the executable (as we had before)
    return path.join(path.dirname(electron.app.getPath('exe')), 'temp')
  }
}

// Log useful paths for debugging
console.log('Platform:', process.platform)
console.log('Environment:', process.env.NODE_ENV)
console.log('__dirname:', __dirname)
console.log('App executable path:', electron.app.getPath('exe'))
console.log('Base directory for data:', getBaseDirectory())

// Define data and dats directories based on the base directory
const dataDirectory = path.join(getBaseDirectory(), 'data')
const datsDirectory = path.join(getBaseDirectory(), 'dats')

console.log('Data directory path:', dataDirectory)
console.log('Dats directory path:', datsDirectory)

// Helper functions to check if directories exist
const dataDirectoryExists = () => {
  return fs.existsSync(dataDirectory)
}

const datsDirectoryExists = () => {
  return fs.existsSync(datsDirectory)
}

const loadMediaPanelConfig = () => {
  try {
    const mediaPanelConfigJson = fs.readFileSync(path.join(datsDirectory, 'mediaPanelConfig.json'), 'utf-8')
    return JSON.parse(mediaPanelConfigJson)
  } catch (error) {
    console.warn('mediaPanelConfig.json not found or invalid. Using default empty object.')
    return {}
  }
}

const loadEmulators = () => {
  try {
    const emulatorsJson = fs.readFileSync(path.join(datsDirectory, 'emulators.json'), 'utf-8')
    return JSON.parse(emulatorsJson)
  } catch (error) {
    console.warn('emulators.json not found or invalid. Using default empty array.')
    return []
  }
}

// Define logger config path based on the same base directory logic
const loggerConfigPath = path.join(getBaseDirectory(), 'loggerConfig.json')

// Load or create the logger config
const getLoggerConfig = () => {
  try {
    // Check if config file exists
    if (fs.existsSync(loggerConfigPath)) {
      console.log('Loading external logger config from:', loggerConfigPath)
      const configData = fs.readFileSync(loggerConfigPath, 'utf-8')
      return JSON.parse(configData)
    } else {
      console.log('Creating default logger config at:', loggerConfigPath)

      // Default config based on the original - TODO: load from template instead
      const defaultConfig = [
        { feature: 'remixRoutes', enabled: true },
        { feature: 'gridOperations', enabled: true },
        { feature: 'fileOperations', enabled: true },
        { feature: 'pathConversion', enabled: false },
        { feature: 'goodMergeChoosing', enabled: true },
        { feature: 'screenshots', enabled: false },
        { feature: 'tabContent', enabled: true },
        { feature: 'icons', enabled: false },
        { feature: 'lightbox', enabled: false }
      ]

      // Make sure directory exists
      const dir = path.dirname(loggerConfigPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      // Write default config to file
      fs.writeFileSync(loggerConfigPath, JSON.stringify(defaultConfig, null, 2), 'utf-8')
      return defaultConfig
    }
  } catch (error) {
    console.error('Error loading/creating logger config:', error)
    // Return a minimal default if something goes wrong
    return [
      { feature: 'remixRoutes', enabled: true },
      { feature: 'fileOperations', enabled: true }
    ]
  }
}

// Create and export the logger instance
const serverLogger = createFeatureLogger(getLoggerConfig())

export {
  dataDirectory,
  dataDirectoryExists,
  datsDirectory,
  datsDirectoryExists,
  loadMediaPanelConfig,
  loadEmulators,
  getTempDirectory,
  loggerConfigPath,
  serverLogger as logger
}
