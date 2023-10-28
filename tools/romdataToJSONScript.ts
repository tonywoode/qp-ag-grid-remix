//run with npx tsx ./tools/romdataToJSONScript.ts
import { convertRomDataToJSON, saveToJSONFile } from '../app/utils/romdataToJSON'

// Usage
const inputFile = 'test/example_inputs/Romdata.dat'
const outputFile = 'data/romdata.json'

const jsonData = convertRomDataToJSON(inputFile)
saveToJSONFile(jsonData, outputFile)

console.log(`Conversion complete. Output saved to ${outputFile}`)
