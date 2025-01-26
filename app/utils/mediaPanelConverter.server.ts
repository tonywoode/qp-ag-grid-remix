import * as fs from 'fs'
import * as ini from 'ini'
import * as iconv from 'iconv-lite'

// Function to decode hex strings
function decodeHex(hex: string): string {
  const buffer = Buffer.from(hex, 'hex')
  return iconv.decode(buffer, 'utf16le')
}

// Move all the mappings from the original file
const searchTypeMapping: { [key: number]: string } = {
  0: 'ExactMatch',
  1: 'StartsWith',
  2: 'InString',
  3: 'AllFilesInDir'
}

const searchTabTypeMapping: { [key: number]: string } = {
  0: 'Images',
  1: 'MameInfo',
  2: 'MameHistory',
  3: 'Thumbnail',
  4: 'System',
  5: 'RomInfo',
  6: 'MameCommand',
  7: 'MameGameInit',
  8: 'MameMessInfo',
  9: 'MameStory',
  10: 'MameSysinfo'
}

// Function to decode TABS entries - moved from original
function decodeTabs(tabs: string): any {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _version = Buffer.from(tabs.slice(0, 8), 'hex').readUInt32LE(0)
  const captionLength = Buffer.from(tabs.slice(8, 16), 'hex').readUInt32LE(0)
  const caption = Buffer.from(tabs.slice(16, 16 + captionLength * 2), 'hex').toString('ascii')
  const enabled = Boolean(Buffer.from(tabs.slice(16 + captionLength * 2, 16 + captionLength * 2 + 2), 'hex').readUInt8(0)) // prettier-ignore
  const mameUseParentForSrch = Boolean(Buffer.from(tabs.slice(16 + captionLength * 2 + 2, 16 + captionLength * 2 + 4), 'hex').readUInt8(0)) // prettier-ignore
  const searchTypeNumber = Buffer.from(tabs.slice(16 + captionLength * 2 + 4, 16 + captionLength * 2 + 6), 'hex').readUInt8(0) // prettier-ignore
  const tabTypeNumber = Buffer.from(
    tabs.slice(16 + captionLength * 2 + 6, 16 + captionLength * 2 + 8),
    'hex'
  ).readUInt8(0)
  const searchInRomPath = Boolean(Buffer.from(tabs.slice(16 + captionLength * 2 + 8, 16 + captionLength * 2 + 10), 'hex').readUInt8(0)) // prettier-ignore
  const pathLength = Buffer.from(tabs.slice(16 + captionLength * 2 + 10, 16 + captionLength * 2 + 18), 'hex').readUInt32LE(0) // prettier-ignore
  const path = Buffer.from(tabs.slice(16 + captionLength * 2 + 18, 16 + captionLength * 2 + 18 + pathLength * 2), 'hex').toString('ascii').split('\r\n') // prettier-ignore

  const filteredPath = path.filter(p => p !== '')
  const searchType = searchTypeMapping[searchTypeNumber]
  const tabType = searchTabTypeMapping[tabTypeNumber]

  return {
    caption,
    enabled,
    mameUseParentForSrch,
    searchType,
    searchInRomPath,
    tabType,
    ...(filteredPath.length > 0 ? { path: filteredPath } : {})
  }
}

function toCamelCase(str: string): string {
  return str[0].toLowerCase() + str.slice(1)
}

export async function convertMediaPanel(inputPath: string, outputPath: string): Promise<boolean> {
  // Read and parse the INI file
  const data = fs.readFileSync(inputPath, 'utf-8')
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

  // Combine the -CFG and -TABS entries
  const combinedData: any = {}
  for (const key in parsedData) {
    if (key === 'MediaSettings') {
      combinedData[key] = parsedData[key]
    } else {
      const lastHyphenIndex = key.lastIndexOf('-')
      const systemName = key.substring(0, lastHyphenIndex)
      const entryType = key.substring(lastHyphenIndex + 1)
      let entryData = parsedData[key]

      if (Object.values(entryData).every(value => !value)) {
        continue
      }

      entryData = Object.keys(entryData).reduce((result: { [key: string]: any }, key) => {
        result[toCamelCase(key)] = entryData[key]
        return result
      }, {})

      if (!combinedData[systemName]) {
        combinedData[systemName] = {}
      }
      if (entryType === 'CFG') {
        combinedData[systemName] = { ...combinedData[systemName], ...entryData }
      } else {
        combinedData[systemName][entryType] = entryData
      }
    }
  }

  // Create sorted data and process TABS
  const sortedCombinedData: any = {}
  Object.keys(combinedData)
    .sort()
    .forEach(key => {
      sortedCombinedData[key] = combinedData[key]
    })

  // Process TABS data
  for (const systemName in sortedCombinedData) {
    if (sortedCombinedData[systemName].TABS) {
      const tabsData = sortedCombinedData[systemName].TABS
      const newTabsData: any = []
      let newKey = 0

      for (const key in tabsData) {
        if (tabsData[key].enabled) {
          const newTabData = { tabOrder: newKey, ...tabsData[key] }
          for (const tabKey in newTabData) {
            if (newTabData[tabKey] === false) {
              delete newTabData[tabKey]
            }
          }
          newTabsData.push(newTabData)
          newKey++
        }
      }

      for (const key in newTabsData) {
        delete newTabsData[key].enabled
      }

      if (Object.keys(newTabsData).length === 0) {
        delete sortedCombinedData[systemName].TABS
      } else {
        sortedCombinedData[systemName].tabs = newTabsData
        delete sortedCombinedData[systemName].TABS
      }
    }
  }

  // Remove empty system entries
  for (const systemName in sortedCombinedData) {
    if (Object.keys(sortedCombinedData[systemName]).length === 0) {
      delete sortedCombinedData[systemName]
    }
  }

  // Extract and handle MediaSettings
  const mediaSettings = { MediaSettings: sortedCombinedData.MediaSettings }
  delete sortedCombinedData.MediaSettings

  // Write the output files
  fs.writeFileSync(outputPath, JSON.stringify(sortedCombinedData, null, 2))
  fs.writeFileSync(
    outputPath.replace('mediaPanelConfig.json', 'mediaPanelSettings.json'),
    JSON.stringify(mediaSettings, null, 2)
  )

  return true
}

// CLI support
if (require.main === module) {
  const inputFile = process.argv[2] || 'test/example_inputs/mediaPanelCfg.ini'
  const outputFile = process.argv[3] || 'test/example_outputs/mediaPanelConfig.json'

  convertMediaPanel(inputFile, outputFile)
    .then(() => console.log('Media panel configuration converted successfully'))
    .catch(console.error)
}
