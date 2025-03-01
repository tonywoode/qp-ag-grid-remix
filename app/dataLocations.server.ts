import fs from 'fs'
import path from 'path'
import electron from '~/electron.server'

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

// Log useful paths for debugging
console.log('Platform:', process.platform)
console.log('Environment:', process.env.NODE_ENV)
console.log('__dirname:', __dirname)
console.log('App executable path:', electron.app.getPath('exe'))
console.log('User data path:', electron.app.getPath('userData'))
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

export { dataDirectory, dataDirectoryExists, datsDirectory, datsDirectoryExists, loadMediaPanelConfig, loadEmulators }
