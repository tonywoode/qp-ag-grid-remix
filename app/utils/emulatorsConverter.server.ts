import * as fs from 'fs'
import * as ini from 'ini'

export async function convertEmulators(inputFile: string, outputFile: string): Promise<boolean> {
  const data = fs.readFileSync(inputFile, 'utf8')

  // Parse the INI-like data
  const sections = ini.parse(data)

  // Convert the sections to the desired format
  const emulators = Object.keys(sections).map(key => ({
    emulatorName: key,
    ...sections[key]
  }))

  // Filter out empty values
  emulators.forEach(emulator => {
    Object.keys(emulator).forEach(key => {
      if (emulator[key] === '') {
        delete emulator[key]
      }
    })
  })

  fs.writeFileSync(outputFile, JSON.stringify(emulators, null, 2))
  return true
}
