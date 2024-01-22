import * as fs from 'fs'
import * as ini from 'ini'
import * as iconv from 'iconv-lite'

// Function to decode hex strings
function decodeHex(hex: string): string {
  const buffer = Buffer.from(hex, 'hex')
  return iconv.decode(buffer, 'utf16le')
}

const searchTypeMapping = {
  0: 'ExactMatch',
  1: 'StartsWith',
  2: 'InString',
  3: 'AllFilesInDir'
}

// Function to decode TABS entries
function decodeTabs(tabs: string): any {
  const version = Buffer.from(tabs.slice(0, 8), 'hex').readUInt32LE(0)
  const captionLength = Buffer.from(tabs.slice(8, 16), 'hex').readUInt32LE(0)
  const caption = Buffer.from(tabs.slice(16, 16 + captionLength * 2), 'hex').toString('ascii')
  const enabled = Boolean(Buffer.from(tabs.slice(16 + captionLength * 2, 16 + captionLength * 2 + 2), 'hex').readUInt8(0)) // prettier-ignore
  const mameUseParentForSrch = Boolean(Buffer.from(tabs.slice(16 + captionLength * 2 + 2, 16 + captionLength * 2 + 4), 'hex').readUInt8(0)) // prettier-ignore
  const searchTypeNumber = Buffer.from(tabs.slice(16 + captionLength * 2 + 4, 16 + captionLength * 2 + 6), 'hex').readUInt8(0) // prettier-ignore
  const searchInRomPath = Boolean(Buffer.from(tabs.slice(16 + captionLength * 2 + 8, 16 + captionLength * 2 + 10), 'hex').readUInt8(0)) // prettier-ignore
  const pathLength = Buffer.from(tabs.slice(16 + captionLength * 2 + 10, 16 + captionLength * 2 + 18), 'hex').readUInt32LE(0) // prettier-ignore
  const path = Buffer.from(tabs.slice(16 + captionLength * 2 + 18, 16 + captionLength * 2 + 18 + pathLength * 2), 'hex').toString('ascii').split('\r\n') // prettier-ignore

  // Filter out empty strings from the path array, else every path has an empty array
  const filteredPath = path.filter(p => p !== '')
  // conert the searchType number into its string value
  const searchType = searchTypeMapping[searchTypeNumber]
  return {
    // version, remove this key because there was only ever a v1
    caption,
    enabled,
    mameUseParentForSrch,
    searchType,
    searchInRomPath,
    // Add the path key only if the filteredPath array is not empty
    ...(filteredPath.length > 0 ? { path: filteredPath } : {})
  }
}

// Read the INI file
const data = fs.readFileSync('./test/example_inputs/mediaPanelCfg.ini', 'utf-8')

// system names with periods will be corrupted by ini library, it'll try to use them as property access, this will affect following json too! Convert and then convert back after
// Replace periods within square brackets with a different character and parse the INI file
let parsedData = ini.parse(data.replace(/(\[[^\]]+\])/g, match => match.replace(/\./g, '___')))
// Replace the character back in the keys

parsedData = Object.fromEntries(
  Object.entries(parsedData).map(([key, value]) => {
    if (key === 'MediaSettings') {
      return [key, value]
    }
    return [key.replace(/___/g, '.'), value]
  })
)

// Decode the hex strings
for (const key in parsedData) {
  if (key !== 'MediaSettings') {
    for (const subKey in parsedData[key]) {
      // Always remove 'ShowAddInfo'
      if (subKey === 'ShowAddInfo') {
        if (parsedData[key][subKey] === '0' && !parsedData[key].AddInfo) {
          delete parsedData[key].AddInfo
        }
        delete parsedData[key][subKey]
      } else if (typeof parsedData[key][subKey] === 'string' && /^[0-9a-fA-F]+$/.test(parsedData[key][subKey])) {
        if (key.endsWith('-TABS')) {
          parsedData[key][subKey] = decodeTabs(parsedData[key][subKey])
        } else if (subKey === 'AddInfo') {
          parsedData[key][subKey] = Buffer.from(parsedData[key][subKey], 'hex').toString('ascii')
        } else {
          parsedData[key][subKey] = decodeHex(parsedData[key][subKey])
        }
      }
    }
  }
}

// Combine the -CFG and -TABS entries for each system
const combinedData: any = {}
for (const key in parsedData) {
  if (key === 'MediaSettings') {
    combinedData[key] = parsedData[key]
  } else {
    const lastHyphenIndex = key.lastIndexOf('-')
    const systemName = key.substring(0, lastHyphenIndex)
    const entryType = key.substring(lastHyphenIndex + 1)
    const entryData = parsedData[key]

    // Exclude entries where all keys have falsy values
    if (Object.values(entryData).every(value => !value)) {
      continue
    }

    if (!combinedData[systemName]) {
      combinedData[systemName] = {}
    }
    combinedData[systemName][entryType] = entryData
  }
}

// Iterate over the keys in the combinedData object
for (const systemName in combinedData) {
  // Check if the systemData has a TABS property
  if (combinedData[systemName].TABS) {
    const tabsData = combinedData[systemName].TABS
    const newTabsData: any = {}
    let newKey = 0

    // Iterate over the keys in the tabsData object
    for (const key in tabsData) {
      // Check if the enabled property is true
      if (tabsData[key].enabled) {
        // Assign the value to the new key in the newTabsData object
        newTabsData[newKey] = tabsData[key]
        newKey++
      }
    }

    // Remove the enabled property from the tabs in the newTabsData object
    for (const key in newTabsData) {
      delete newTabsData[key].enabled
    }

    // Check if the newTabsData object is empty
    if (Object.keys(newTabsData).length === 0) {
      // Delete the TABS key from the system entry
      delete combinedData[systemName].TABS
    } else {
      // Replace the TABS property in the combinedData object with the newTabsData object
      combinedData[systemName].TABS = newTabsData
    }
  }

  // Check if the system entry is empty
  if (Object.keys(combinedData[systemName]).length === 0) {
    // Delete the system entry from combinedData
    delete combinedData[systemName]
  }
}

// Write the output to a JSON file
fs.writeFileSync('./test/example_outputs/mediaPanelConfig.json', JSON.stringify(combinedData, null, 2))