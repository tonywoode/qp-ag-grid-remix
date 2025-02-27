import fs from 'fs'
import path from 'path'
import { emulators } from '~/root' // Import emulators from root

export function loadRomdata(romdataPathStarred) {
  //swap the * back to / for the path
  const romdataPath = romdataPathStarred.replace(/\*/g, '/')
  //add the cwd to the path
  const romdataPathFull = path.join(process.cwd(), romdataPath)
  //use fs.readFileSync to load the path
  const romdataRaw = fs.readFileSync(romdataPathFull, 'utf8')
  // romdata is json, so parse it
  const romdata = JSON.parse(romdataRaw)

  // Create a map from emulatorName to system
  const emulatorToSystem = new Map(emulators.map(emulator => [emulator.emulatorName, emulator.system]))

  // Add a system property to each row in romdata.romdata
  romdata.romdata.forEach(row => {
    row.system = emulatorToSystem.get(row.emulatorName) || 'Unknown'
  })

  return romdata
}
