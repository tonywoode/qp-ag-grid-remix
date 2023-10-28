import fs from 'fs'
import ini from 'ini'

// Read the input file
fs.readFile('/Volumes/Untitled/Emulators/QUICKPLAY/QuickPlayFrontend/qp/dats/emulators.ini', 'utf8', (err, data) => {
  if (err) {
    console.error(err)
    return
  }

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

  // Write the JSON to a file
  const outputFolder = 'dats'
  fs.mkdirSync(outputFolder, { recursive: true })
  const outputPath = `${outputFolder}/emulators.json`
  fs.writeFile(outputPath, JSON.stringify(emulators, null, 2), err => {
    if (err) {
      console.error(err)
      return
    }
    console.log(`Emulators data saved to ${outputPath}`)
  })
})
