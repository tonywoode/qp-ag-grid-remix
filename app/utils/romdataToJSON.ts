import * as fs from 'fs'

// Function to parse a single romdata line
function removeEmptyFields(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== ''))
}

function parseRomDataLine(line, gamesDirPathPrefix) {
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

  //The idea is to allow users who have a common Games drive to have more cross-platform possibilities, change the platform specific path
  //to a generic {gameDrive} path, and then have the frontend replace it with the appropriate path for the platform
  const modifiedPath =
    gamesDirPathPrefix && path.startsWith(gamesDirPathPrefix) ? path.replace(gamesDirPathPrefix, '{gamesDir}') : path

  return removeEmptyFields({
    name,
    mameName,
    parentName,
    zipName,
    path: modifiedPath,
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
  })
}

/**
 * Read romdata file and convert to JSON,
 * @param {string} filename - path to romdata file
 * @param {string} gamesDirPathPrefix - path to game drive, used to convert romdata paths to absolute paths
 * @returns {object} - object with a versionInfo key and a romdata key
 * @example
 * const inputFile = 'test/example_inputs/Romdata.dat'
 * const outputFile = 'data/romdata.json'
 */
export function convertRomDataToJSON(filename, gamesDirPathPrefix) {
  const data = fs.readFileSync(filename, 'latin1')
  const lines = data.split('\n').filter(Boolean)

  // Check if there's actual ROM data beyond the version line, I had this!
  if (lines.length <= 1) {
    console.log('No ROM data found.')
    return null
  }

  const romdata = lines.slice(1).map(line => parseRomDataLine(line, gamesDirPathPrefix))

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
