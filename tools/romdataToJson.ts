const fs = require('fs')

// Function to parse a single romdata line
function parseRomDataLine(line) {
  const [
    name,
    mameName,
    parentName,
    zipName,
    path,
    emulatorName,
    companyName,
    year,
    gameType,
    rating,
    language,
    parameters,
    comment,
    timesPlayed,
    paramMode,
    ipsOpen,
    ipsClose,
    players,
    defaultGoodMerge
  ] = line.split('¬')

  return {
    name,
    mameName,
    parentName,
    zipName,
    path,
    emulatorName,
    companyName,
    year,
    gameType,
    rating,
    language,
    parameters,
    comment,
    timesPlayed,
    paramMode,
    ips: `${ipsOpen}${ipsClose}`.replace(/^<IPS>(.*)<\/IPS>$/, ''),
    players,
    defaultGoodMerge
  }
}

// Read romdata file and convert to JSON
function convertRomDataToJSON(filename) {
  const data = fs.readFileSync(filename, 'latin1')
  const lines = data.split('\n').filter(Boolean)

  const romdata = lines.slice(1).map(parseRomDataLine)

  return {
    versionInfo: {
      'ROM DataFile JSON Version': '1.0'
    },
    romdata
  }
}

// Write JSON to file
function saveToJsonFile(data, filename) {
  fs.writeFileSync(filename, JSON.stringify(data, null, 2))
}

// Usage
const inputFile = 'inputs/Romdata.dat'
const outputFile = 'outputs/romdata.json'

const jsonData = convertRomDataToJSON(inputFile)
saveToJsonFile(jsonData, outputFile)

console.log(`Conversion complete. Output saved to ${outputFile}`)
