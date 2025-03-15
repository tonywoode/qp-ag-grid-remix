import fs from 'fs'
import path from 'path'
import os from 'os'
import electron from '~/electron.server'
import { createFeatureLogger } from '~/utils/featureLogger'
import { loadLoggerTemplate } from '~/utils/loggerTemplateLoader.server'

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
    // Use our dedicated loader to get the template
    let templateConfig
    try {
      templateConfig = loadLoggerTemplate()
      // Ensure all template values are set to false for new configs
      templateConfig = templateConfig.map(item => ({ ...item, enabled: false }))
    } catch (error) {
      // This should never happen in production as the template should be bundled with the app
      console.error('FATAL: Failed to load logger template:', error)
      throw new Error(
        `Logger template file missing or invalid. This indicates a problem with the application installation.`
      )
    }

    // Check if config file exists
    if (fs.existsSync(loggerConfigPath)) {
      console.log('Loading external logger config from:', loggerConfigPath)
      const configData = fs.readFileSync(loggerConfigPath, 'utf-8')
      const userConfig = JSON.parse(configData)

      // Check if all template features exist in user's config
      const templateFeatures = new Set(templateConfig.map(item => item.feature))
      const userFeatures = new Set(userConfig.map(item => item.feature))

      // Simple check: are the sets the same size and does every template feature exist in user config?
      const hasAllFeatures =
        templateFeatures.size === userFeatures.size && [...templateFeatures].every(feature => userFeatures.has(feature))

      if (hasAllFeatures) {
        console.log('User config is up-to-date with all logging features')
        return userConfig
      } else {
        console.log('User config is missing some logging features, replacing with default template')

        // Write the default config to file (all features disabled)
        fs.writeFileSync(loggerConfigPath, JSON.stringify(templateConfig, null, 2), 'utf-8')
        return templateConfig
      }
    } else {
      console.log('Creating new logger config at:', loggerConfigPath)

      // Make sure directory exists
      const dir = path.dirname(loggerConfigPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      // Write default config to file
      fs.writeFileSync(loggerConfigPath, JSON.stringify(templateConfig, null, 2), 'utf-8')
      return templateConfig
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

// Show the effective logger configuration that will be used by the app
const activeLoggerConfig = getLoggerConfig().filter(item => item.enabled)
console.log('Active logging features:', activeLoggerConfig.length === 0 
  ? 'None (all logging disabled)' 
  : activeLoggerConfig.map(item => item.feature).join(', ')
)
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
