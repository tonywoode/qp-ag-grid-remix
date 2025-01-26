//the CLI version of the QP data converter, note we pass it the root QP dir, not say the data subfolder, but it writes the data folder
//to run npx tsx tools/convertQuickPlayData.ts /path/to/quickplay [optional-output-path]
// atm argv2 would be /Volumes/Untitled/Emulators/QUICKPLAY/QuickPlayFrontend/qp/data
// and argv3 would be 'data' in qpjs folder (we're only converting romdata folder)
import { convertQuickPlayData } from '../app/utils/quickPlayConverter.server'

const sourcePath = process.argv[2]
const destPath = process.argv[3]
const options = {
  convertRomdata: !process.argv.includes('--no-romdata'),
  convertSystems: !process.argv.includes('--no-systems'),
  convertEmulators: !process.argv.includes('--no-emulators'),
  convertMediaPanel: !process.argv.includes('--no-media-panel')
}

if (!sourcePath) {
  console.error('Please provide a source path')
  process.exit(1)
}

convertQuickPlayData(sourcePath, options)
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
