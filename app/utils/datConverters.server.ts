import * as fs from 'fs'
import * as ini from 'ini'
import * as readline from 'readline'
import * as iconv from 'iconv-lite'

export async function convertSystems(inputPath: string, outputPath: string): Promise<void> {
  try {
    const fileStream = fs.createReadStream(inputPath)
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    })

    const systems = []
    for await (const line of rl) {
      systems.push(line)
    }

    await fs.promises.writeFile(outputPath, JSON.stringify(systems, null, 2))
  } catch (error) {
    throw new Error(`Failed to convert systems: ${error.message}`)
  }
}

export async function convertEmulators(inputPath: string, outputPath: string): Promise<void> {
  try {
    const data = await fs.promises.readFile(inputPath, 'utf-8')
    // Parse the INI-like data
    const sections = ini.parse(data)
    // Convert the sections to the desired format
    const emulators = Object.keys(sections).map(key => ({
      emulatorName: key,
      ...sections[key]
    }))
    // Filter out empty values
    emulators.forEach(emulator => {
      Object.keys(emulator).forEach(key => {
        if (emulator[key] === '') {
          delete emulator[key]
        }
      })
    })

    await fs.promises.writeFile(outputPath, JSON.stringify(emulators, null, 2))
  } catch (error) {
    throw new Error(`Failed to convert emulators: ${error.message}`)
  }
}

export async function convertMediaPanel(inputPath: string, outputPath: string): Promise<void> {
  try {
    // Helper functions for media panel conversion
    function decodeHex(hex: string): string {
      const buffer = Buffer.from(hex, 'hex')
      return iconv.decode(buffer, 'utf16le')
    }

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
      // Original note: whilst it isn't terribly sensible to create these new types that all call the same imp but with different string config vars, the alternative is to rewrite a lot of the way media panel options work eg: linking to files not folders and a new form specifically for creating mame dat types that will let you choose the call
      6: 'MameCommand',
      7: 'MameGameInit',
      8: 'MameMessInfo',
      9: 'MameStory',
      10: 'MameSysinfo'
    }

    function decodeTabs(tabs: string): any {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _version = Buffer.from(tabs.slice(0, 8), 'hex').readUInt32LE(0) //ignore this key because there was only ever a v1
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

      // Filter out empty strings from the path array, else every path has an empty array
      const filteredPath = path.filter(p => p !== '')
      // convert the searchType number into its string value
      const searchType = searchTypeMapping[searchTypeNumber]
      const tabType = searchTabTypeMapping[tabTypeNumber]
      return {
        caption,
        enabled,
        mameUseParentForSrch,
        searchType,
        searchInRomPath,
        tabType,
        // Add the path key only if the filteredPath array is not empty
        ...(filteredPath.length > 0 ? { path: filteredPath } : {})
      }
    }

    // Main conversion logic
    const data = await fs.promises.readFile(inputPath, 'utf-8')

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
    // Function to convert a string from PascalCase to camelCase
    function toCamelCase(str: string): string {
      return str[0].toLowerCase() + str.slice(1)
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
        let entryData = parsedData[key]

        // Exclude entries where all keys have falsy values
        if (Object.values(entryData).every(value => !value)) {
          continue
        }

        // Convert the keys of the entryData object to camelCase (sysImage / addInfo instead of SysImage / AddInfo)
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

    // Create a new object with the keys sorted
    const sortedCombinedData: any = {}
    Object.keys(combinedData)
      .sort()
      .forEach(key => {
        sortedCombinedData[key] = combinedData[key]
      })

    // Iterate over the keys in the sortedCombinedData object
    for (const systemName in sortedCombinedData) {
      // Check if the systemData has a TABS property
      if (sortedCombinedData[systemName].TABS) {
        const tabsData = sortedCombinedData[systemName].TABS
        const newTabsData: any = []
        let newKey = 0 //we removed unused tabs, so the key numbering is effectively a sparse arrray, number again

        // Iterate over the keys in the tabsData object
        for (const key in tabsData) {
          // Check if the enabled property is true
          if (tabsData[key].enabled) {
            // Prepare the new tab data
            const newTabData = { tabOrder: newKey, ...tabsData[key] }

            // Remove keys with value false
            for (const tabKey in newTabData) {
              if (newTabData[tabKey] === false) {
                delete newTabData[tabKey]
              }
            }

            // Push the new tab data to the newTabsData array
            newTabsData.push(newTabData)

            // Increment newKey
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
          delete sortedCombinedData[systemName].TABS
        } else {
          // Replace the TABS property in the sortedCombinedData object with the newTabsData object
          sortedCombinedData[systemName].tabs = newTabsData
          delete sortedCombinedData[systemName].TABS
        }
      }
    }
    // Check if the system entry is empty
    for (const systemName in sortedCombinedData) {
      if (Object.keys(sortedCombinedData[systemName]).length === 0) {
        // Delete the system entry from sortedCombinedData
        delete sortedCombinedData[systemName]
      }
    }

    // Extract the MediaSettings key-value pair
    const mediaSettings = { MediaSettings: sortedCombinedData.MediaSettings }

    // Remove the MediaSettings key-value pair from the original data
    delete sortedCombinedData.MediaSettings

    // Write the output to a JSON file
    await fs.promises.writeFile(outputPath, JSON.stringify(sortedCombinedData, null, 2))

    // Write the MediaSettings to a new file
    await fs.promises.writeFile(
      outputPath.replace('mediaPanelConfig.json', 'mediaPanelSettings.json'),
      JSON.stringify(mediaSettings, null, 2)
    )
  } catch (error) {
    throw new Error(`Failed to convert media panel: ${error.message}`)
  }
}
