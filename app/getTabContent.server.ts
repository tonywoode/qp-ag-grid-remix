import fs from 'fs'
import path from 'path'
import { convertWindowsPathToMacPath } from '~/utils/OSConvert.server'

//TODO: mamehistory also contains info about mess consoles!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
function getLeafFilenameForTabType(tabType: string): string {
  const tabTypeToFileMap: { [key: string]: string } = {
    MameHistory: 'history.dat',
    MameInfo: 'mameinfo.dat'
    // Add new tabType and filename pairs here as needed
  }
  return tabTypeToFileMap[tabType] //TODO: no case?
}

async function findHistoryContent(
  pathInTabData: string[],
  romname: string,
  mameNames: { mameName?: string; parentName?: string },
  mameUseParentForSrch: boolean,
  thisSystemsTab: string
): Promise<any> {
  console.log(pathInTabData)
  for (const p of pathInTabData) {
    //Do we have >1 path in for mame dats? We'll only return the first?
    const macPath = convertWindowsPathToMacPath(p)
    console.log('this systems tab type is: ', thisSystemsTab.tabType)
    const leafNameForHistoryType = getLeafFilenameForTabType(thisSystemsTab.tabType)
    if (!leafNameForHistoryType) {
      console.log(`No matching filename found for tabType: ${thisSystemsTab.tabType}`)
      return { error: `No matching filename found for tabType: ${thisSystemsTab.tabType}` } //TODO: throw?
    }
    const historyDatPath = path.join(macPath, leafNameForHistoryType)
    console.log('historyDatPath', historyDatPath)
    const historyExists = await fs.promises //we're assuming this has been set to searchType: 'ExactMatch', which it should
      .stat(historyDatPath)
      .then(() => true)
      .catch(() => false)
    if (historyExists) {
      let historyContent = await fs.promises.readFile(historyDatPath, 'latin1') // Note latin1 for history.dats
      try {
        return findHistoryDatContent(romname, mameNames, mameUseParentForSrch, historyDatPath, historyContent)
        // return findHistoryDatContent(romname, mameNames, mameUseParentForSrch, historyDatPath, historyContent)
      } catch (error) {
        console.error('Error processing history data:', error)
      }
    }
  }
  return { error: 'Associated Mame-dat-style file not found for the provided ROM name' }
}

async function findMameInfoContent (){
  return { error: 'not yet implemented'}
}

//TODO: this is GAME history logic, we don't want to do so much munging for Mame history: we don't want to continue these non-isomporhic transformations, we lose list formattings etc
async function findHistoryDatContent(
  romname: string,
  mameNames: { mameName?: string; parentName?: string },
  mameUseParentForSrch: boolean,
  historyDatPath: string,
  historyContent: string
): Promise<any> {
  const entries = historyContent.split('$end')
  let matchFound = false // Flag to indicate a match has been found
  for (const entry of entries) {
    if (matchFound) break
    //unlike screenshots, we're searching in the found file for a spcefic entry
    let searchTerms = [romname] // Default search term is romname

    // If mameName is present, prioritize it
    if (mameNames.mameName) {
      searchTerms.unshift(mameNames.mameName)
    }

    // If mameParent should be used and is present, add it to the search terms
    if (mameUseParentForSrch && mameNames.parentName) {
      searchTerms.push(mameNames.parentName)
    }

    for (const searchTerm of searchTerms) {
      if (entry.includes(`$info=${searchTerm},`)) {
        matchFound = true
        //original game history entries text bodies are line-width-separated, my fault! Remove unnecessary breaks keep real ones
        let widthFixedContent
        const splitIndex = entry.indexOf('- TECHNICAL -')
        if (splitIndex !== -1) {
          const firstPart = entry.substring(0, splitIndex).trim()
          const secondPart = entry.substring(splitIndex) // Includes "- TECHNICAL -" and what follows
          const processedFirstPart = firstPart
            .split('\r\n\r\n')
            .map(paragraph => paragraph.replace(/\r\n/g, '±±±')) //tag newlines
            .map(paragraph => paragraph.replace(/±±± ±±±/g, '\r\n\r\n')) //restore the real para breaks before...
            .map(paragraph => paragraph.replace(/±±±/g, '')) //...removing the unwanted ones
            .join('\r\n\r\n')
            .trim()
          widthFixedContent = `${processedFirstPart}\r\n\r\n${secondPart}`
        } else {
          widthFixedContent = entry
        }

        // Extract the game title
        const titleMatch = entry.match(/^\$info=([^,]+),?/m)
        const title = titleMatch ? titleMatch[1] : 'Unknown Title'

        // Correct and extract the link, all the game history links are tagged but malformed
        const linkMatch = entry.match(/\$<a href="([^"]+)"/m)
        const link = linkMatch ? linkMatch[1] : ''
        const httpsLink = link.replace('http://', 'https://') // Correcting the link

        // Use the processed content
        const bioIndex = widthFixedContent.indexOf('$bio') + 4 // Start of content
        const content = widthFixedContent.substring(bioIndex).trim().replace('http://', 'https://') // Corrected to extract until the actual end of the entry

        // Construct the JSON object
        const jsonContent = {
          title,
          link: `<a href="${httpsLink}">${httpsLink}</a>`, // Correcting the malformed link
          content
        }
        console.log('jsonContent')
        console.log(jsonContent)
        return jsonContent
      }
    }
  }
  return { error: 'History entry not found for the provided ROM name' }
}

const mimeTypes: { [key: string]: string } = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon'
}

function getMimeType(ext: string): string {
  return mimeTypes[ext] || null //'application/octet-stream' - uhuh - that'll return all files!
}

// TJSearchType = (jstExactMatch = 0,
//   jstStartsWith = 1,
//   jstInString = 2,
//   jstAllFilesInDir = 3);
async function findScreenshotPaths(
  romname: string,
  pathInTabData: string[],
  searchType: string,
  mameNames: { mameName?: string; parentName?: string },
  mameUseParentForSrch: boolean
) {
  console.log(`using searchType ${searchType}`)
  const foundBase64Files = new Set()

  for (const p of pathInTabData) {
    console.log('mameNames.parentName:')
    console.log(mameNames.parentName)
    console.log('mameUseParentForSrch:')
    console.log(mameUseParentForSrch)
    const macPath = convertWindowsPathToMacPath(p)
    let matchFound = false // Flag to indicate a match has been found
    try {
      const files = await fs.promises.readdir(macPath)
      for (const file of files) {
        if (matchFound) break // Exit the loop if a match has been found
        let searchTerms = [romname] // Default search term is romname

        // If mameName is present, prioritize it
        if (mameNames.mameName) {
          searchTerms.unshift(mameNames.mameName)
        }

        // If mameParent should be used and is present, add it to the search terms
        if (mameUseParentForSrch && mameNames.parentName) {
          searchTerms.push(mameNames.parentName)
        }

        // Attempt search with each term, breaking on the first success
        for (const searchTerm of searchTerms) {
          if (searchStrategies(file, searchTerm, searchType)) {
            const filePath = path.join(macPath, file)
            console.log('match found')
            console.log(filePath)
            const fileData = await fs.promises.readFile(filePath)
            const ext = path.extname(file).toLowerCase()
            const mimeType = getMimeType(ext)
            if (mimeType !== null) {
              const base64File = `data:${mimeType};base64,${fileData.toString('base64')}`
              foundBase64Files.add(base64File)
              matchFound = true // Set the flag to true as a match has been found
              break // Found a match, no need to continue with other search terms
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${macPath}: ${error}`)
    }
  }
  return [...foundBase64Files]
}

function searchStrategies(file: string, romname: string, searchType: string): boolean {
  const fileNameWithoutExt = file.substring(0, file.lastIndexOf('.')) || file
  const strategies = {
    ExactMatch: (name: string) => name === romname,
    StartsWith: (name: string) => name.startsWith(romname),
    InString: (name: string) => name.includes(romname),
    AllFilesInDir: (name: string, ext: string) => Object.keys(mimeTypes).includes(ext)
  }

  const strategy = strategies[searchType]
  return strategy ? strategy(fileNameWithoutExt, path.extname(file).toLowerCase()) : false
}

export async function getTabContent(
  tabClass: string,
  searchType: string,
  romname: string,
  thisSystemsTab: string,
  system: string,
  mameNames: Object,
  mameUseParentForSrch: boolean
) {
  const tabData = thisSystemsTab
  console.log(tabData)
  const pathInTabData = tabData ? tabData.path : null
  console.log('Path in tabData is ' + pathInTabData)
  if (pathInTabData) {
    if (tabClass === 'screenshot') {
      const base64Files = await findScreenshotPaths(romname, pathInTabData, searchType, mameNames, mameUseParentForSrch)
      console.log('Found files:', base64Files)
      return { screenshots: base64Files }
    } else if (tabClass === 'history') {
      const history = await findHistoryContent(pathInTabData, romname, mameNames, mameUseParentForSrch, thisSystemsTab)
      console.log('History.dat content:', history)
      return { history }
    } else {
      return {}
    }
  } else {
    console.error(`Error: Screenshot path is not defined for system: ${system}`)
    return {}
  }
}
