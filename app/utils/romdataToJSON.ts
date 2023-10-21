import * as fs from 'fs'

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
export function convertRomDataToJSON(filename) {
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
export function saveToJSONFile(data, filename) {
  fs.writeFileSync(filename, JSON.stringify(data, null, 2))
}
