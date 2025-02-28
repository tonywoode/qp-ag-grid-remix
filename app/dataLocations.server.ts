import fs from 'fs'
import path from 'path'

// Check if the data directory exists
const dataDirectory = path.join(__dirname, '..', 'data')
const dataDirectoryExists = () => {
  return fs.existsSync(dataDirectory)
}

// Check if the dats directory exists
const datsDirectory = path.join(__dirname, '..', 'dats')
const datsDirectoryExists = () => {
  return fs.existsSync(datsDirectory)
}

const loadMediaPanelConfig = () => {
  try {
    const mediaPanelConfigJson = fs.readFileSync(path.join(__dirname, '..', 'dats', 'mediaPanelConfig.json'), 'utf-8')
    return JSON.parse(mediaPanelConfigJson)
  } catch (error) {
    console.warn('mediaPanelConfig.json not found or invalid. Using default empty object.')
    return {}
  }
}

const loadEmulators = () => {
  try {
    const emulatorsJson = fs.readFileSync(path.join(__dirname, '..', 'dats', 'emulators.json'), 'utf-8')
    return JSON.parse(emulatorsJson)
  } catch (error) {
    console.warn('emulators.json not found or invalid. Using default empty array.')
    return []
  }
}

export { dataDirectory, dataDirectoryExists, datsDirectory, datsDirectoryExists, loadMediaPanelConfig, loadEmulators }
