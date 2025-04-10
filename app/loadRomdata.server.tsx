import fs from 'fs'
import path from 'path'
import { loadEmulators } from '~/dataLocations.server' // Import loadEmulators from dataLocations.server

export function loadRomdata(romdataPathStarred) {
  //swap the * back to / for the path
  const romdataPath = romdataPathStarred.replace(/\*/g, '/')
  //use fs.readFileSync to load the path
  const romdataRaw = fs.readFileSync(romdataPath, 'utf8')
  // romdata is json, so parse it
  const romdata = JSON.parse(romdataRaw)

  // Load emulators dynamically
  const emulators = loadEmulators()

  // Create a map from emulatorName to system
  const emulatorToSystem = new Map(emulators.map(emulator => [emulator.emulatorName, emulator.system]))

  // Add a system property to each row in romdata.romdata
  romdata.romdata.forEach(row => {
    row.system = emulatorToSystem.get(row.emulatorName) || 'Unknown'
  })

  return romdata
}
