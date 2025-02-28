//the CLI version of the QP data converter
//to run: npx tsx tools/convertQuickPlayData.ts /path/to/quickplay /path/to/output/data /path/to/output/dats
//
//This tool converts QuickPlay data to the format used by this application.
//It requires the path to the QuickPlay installation directory (which should contain 'data' and 'dats' subdirectories)
//followed by the full output paths for both the data and dats directories.
//
//flags available:
//--no-romdata : skip ROM data conversion
//--no-systems : skip systems.dat conversion
//--no-emulators : skip emulators.ini conversion
//--no-media-panel : skip media panel configuration conversion
import * as fs from 'fs'
import * as path from 'path'
import { convertQuickPlayData, validateQuickPlayDirectory } from '../app/utils/quickPlayConverter.server'

const sourcePath = process.argv[2]
const dataPath = process.argv[3]
const datsPath = process.argv[4]

if (!sourcePath || !dataPath || !datsPath) {
  console.error('Usage: convertQuickPlayData.ts <sourcePath> <outputDataPath> <outputDatsPath>')
  console.error('Example: convertQuickPlayData.ts /path/to/quickplay ./data ./dats')
  process.exit(1)
}

// Check output directories before proceeding
if (fs.existsSync(dataPath)) {
  console.error(`Warning: Data directory already exists at ${dataPath}`)
  process.exit(1)
}

if (fs.existsSync(datsPath)) {
  console.error(`Warning: Dats directory already exists at ${datsPath}`)
  process.exit(1)
}

// Validate QuickPlay directory first
validateQuickPlayDirectory(sourcePath)
  .then(() => {
    console.log('Valid QuickPlay directory found')
    console.log(`Output data directory: ${dataPath}`)
    console.log(`Output dats directory: ${datsPath}`)

    return convertQuickPlayData(
      sourcePath,
      {
        convertRomdata: !process.argv.includes('--no-romdata'),
        convertSystems: !process.argv.includes('--no-systems'),
        convertEmulators: !process.argv.includes('--no-emulators'),
        convertMediaPanel: !process.argv.includes('--no-media-panel')
      },
      dataPath,
      datsPath
    )
  })
  .then(result => {
    if (result.success) {
      console.log('Conversion completed successfully:')
      if (result.romdataFiles) console.log(`- Converted ${result.romdataFiles} ROM data files`)
      if (result.systemsConverted) console.log('- Converted systems data')
      if (result.emulatorsConverted) console.log('- Converted emulators data')
      if (result.mediaPanelConverted) console.log('- Converted media panel configuration')
    } else {
      console.error(`Conversion failed: ${result.error?.component} - ${result.error?.message}`)
      process.exit(1)
    }
  })
  .catch(error => {
    console.error('Error:', error.message)
    process.exit(1)
  })
