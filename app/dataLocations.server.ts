import fs from 'fs'
import path from 'path'

// Load emulators.json or use an empty object as a default
let emulators = []
try {
  const emulatorsJson = fs.readFileSync(path.join(__dirname, '..', 'dats', 'emulators.json'), 'utf-8') 
  emulators = JSON.parse(emulatorsJson)
} catch (error) {
  console.warn('emulators.json not found or invalid. Using default empty object.')
  emulators = [] // Ensure emulators is an empty array
}

// Load mediaPanelConfig.json or use an empty object as a default
let mediaPanelConfig = {}
try {
  const mediaPanelConfigJson = fs.readFileSync(path.join(__dirname, '..', 'dats', 'mediaPanelConfig.json'), 'utf-8')
  mediaPanelConfig = JSON.parse(mediaPanelConfigJson)
} catch (error) {
  console.warn('mediaPanelConfig.json not found or invalid. Using default empty object.')
  mediaPanelConfig = {} // Ensure mediaPanelConfig is an empty object
}

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

export { emulators, mediaPanelConfig, dataDirectory, dataDirectoryExists, datsDirectoryExists }
