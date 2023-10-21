import { convertRomDataToJSON, saveToJSONFile } from '../app/utils/romdataToJSON'

// Usage
const inputFile = 'inputs/Romdata.dat'
const outputFile = 'outputs/romdata.json'

const jsonData = convertRomDataToJSON(inputFile)
saveToJSONFile(jsonData, outputFile)

console.log(`Conversion complete. Output saved to ${outputFile}`)
