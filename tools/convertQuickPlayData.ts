//the CLI version of the QP data converter, note we pass it the root QP dir, not say the data subfolder, but it writes the data folder
//to run npx tsx tools/convertQuickPlayData.ts /path/to/quickplay [optional-output-path]
// atm argv2 would be /Volumes/Untitled/Emulators/QUICKPLAY/QuickPlayFrontend/qp/data
// and argv3 would be 'data' in qpjs folder (we're only converting romdata folder)
import { convertQuickPlayData } from '../app/utils/convertQuickPlayData.server'

const sourcePath = process.argv[2]
const destPath = process.argv[3]

if (!sourcePath) {
  console.error('Please provide a source path')
  process.exit(1)
}

convertQuickPlayData(sourcePath, destPath)
  .then(convertedFiles => {
    console.log(`Successfully converted ${convertedFiles} romdata files`)
  })
  .catch(error => {
    console.error('Error:', error.message)
    process.exit(1)
  })
