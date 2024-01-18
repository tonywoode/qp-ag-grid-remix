import * as fs from 'fs'
import * as ini from 'ini'
import * as iconv from 'iconv-lite'

// Function to decode hex strings
function decodeHex(hex: string): string {
  const buffer = Buffer.from(hex, 'hex')
  return iconv.decode(buffer, 'utf16le')
}

// Function to decode TABS entries
function decodeTabs(tabs: string): any {
  const version = Buffer.from(tabs.slice(0, 8), 'hex').readUInt32LE(0)
  const captionLength = Buffer.from(tabs.slice(8, 16), 'hex').readUInt32LE(0)
  const caption = Buffer.from(tabs.slice(16, 16 + captionLength * 2), 'hex').toString('ascii')
  //const enabled = Boolean(parseInt(tabs.slice(16 + captionLength * 2, 16 + captionLength * 2 + 2), 16))
  const enabled = Boolean(
    Buffer.from(tabs.slice(16 + captionLength * 2, 16 + captionLength * 2 + 2), 'hex').readUInt8(0)
  )
  //const mameUseParentForSrch = Boolean(parseInt(tabs.slice(16 + captionLength * 2 + 2, 16 + captionLength * 2 + 4), 16))
  const mameUseParentForSrch = Boolean(
    Buffer.from(tabs.slice(16 + captionLength * 2 + 2, 16 + captionLength * 2 + 4), 'hex').readUInt8(0)
  )

  const searchType = decodeHex(tabs.slice(16 + captionLength * 2 + 4, 16 + captionLength * 2 + 8))
  //const searchInRomPath = Boolean(parseInt(tabs.slice(16 + captionLength * 2 + 8, 16 + captionLength * 2 + 10), 16))
  const searchInRomPath = Boolean(
    Buffer.from(tabs.slice(16 + captionLength * 2 + 8, 16 + captionLength * 2 + 10), 'hex').readUInt8(0)
  )
  const pathLength = Buffer.from(
    tabs.slice(16 + captionLength * 2 + 10, 16 + captionLength * 2 + 18),
    'hex'
  ).readUInt32LE(0)
  const path = Buffer.from(tabs.slice(16 + captionLength * 2 + 18, 16 + captionLength * 2 + 18 + pathLength * 2), 'hex')
    .toString('ascii')
    .split('\r\n')

  return {
    version,
    caption,
    enabled,
    mameUseParentForSrch,
    searchType,
    searchInRomPath,
    path
  }
}

// Read the INI file
const data = fs.readFileSync('./test/example_inputs/mediaPanelCfg.ini', 'utf-8')

// Parse the INI file
let parsedData = ini.parse(data)

// Decode the hex strings
for (const key in parsedData) {
  for (const subKey in parsedData[key]) {
    if (subKey === 'ShowAddInfo') {
      parsedData[key][subKey] = parseInt(parsedData[key][subKey])
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

// Combine the -CFG and -TABS entries for each system
const combinedData: any = {}
for (const key in parsedData) {
  const systemName = key.split('-')[0]
  const entryType = key.split('-')[1]
  if (!combinedData[systemName]) {
    combinedData[systemName] = {}
  }
  combinedData[systemName][entryType] = parsedData[key]
}

// Write the output to a JSON file
fs.writeFileSync('./test/example_outputs/mediaPanelConfig.json', JSON.stringify(combinedData, null, 2))
