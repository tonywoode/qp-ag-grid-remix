//the CLI version of the QP data converter, note we pass it the root QP dir, not say the data subfolder
//to run npx tsx tools/convertQuickPlayData.ts /path/to/quickplay [output-dir]
// atm argv2 would be /Volumes/Untitled/Emulators/QUICKPLAY/QuickPlayFrontend/qp
// and argv3 would be ./output (defaults to current directory)
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
const outputDir = process.argv[3] || '.'

if (!sourcePath) {
  console.error('Usage: convertQuickPlayData.ts <sourcePath> [outputDir]')
  console.error('Example: convertQuickPlayData.ts /path/to/quickplay ./output')
  process.exit(1)
}

// Check output directories before proceeding
const dataPath = path.join(outputDir, 'data')
const datsPath = path.join(outputDir, 'dats')

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
    console.log(`Output directory: ${outputDir}`)

    return convertQuickPlayData(
      sourcePath,
      {
        convertRomdata: !process.argv.includes('--no-romdata'),
        convertSystems: !process.argv.includes('--no-systems'),
        convertEmulators: !process.argv.includes('--no-emulators'),
        convertMediaPanel: !process.argv.includes('--no-media-panel')
      },
      undefined, // No backup choice needed for CLI, ensure existing dirs are backed up yourself we wont overwrite data/dats dirs
      outputDir
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
