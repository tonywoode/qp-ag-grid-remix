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

export { emulators }
