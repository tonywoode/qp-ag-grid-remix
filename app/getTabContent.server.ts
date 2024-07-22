import fs from 'fs'
import path from 'path'
import { convertWindowsPathToMacPath } from '~/utils/OSConvert.server'

const tabTypeStrategy: { [key: string]: TabStrategy } = {
  MameHistory: {
    datLeafFilename: 'history.dat',
    contentFinder: findHistoryDatContent
  },
  MameInfo: {
    datLeafFilename: 'mameinfo.dat',
    contentFinder: findMameInfoContent
  },
  MameCommand: {
    datLeafFilename: 'command.dat',
    contentFinder: findMameCommandContent
  },
  MameGameInit: {
    datLeafFilename: 'gameinit.dat',
    contentFinder: findMameGameInitContent
  },
  MameStory: {
    datLeafFilename: 'story.dat',
    contentFinder: findMameStoryContent
  },
  MameMessInfo: {
    datLeafFilename: 'messinfo.dat',
    contentFinder: findMameMessInfoContent
  }
  // Add new tabType and strategy pairs here as needed
}

function getTabTypeStrategy(tabType: string): TabStrategy | null {
  const strategy = tabTypeStrategy[tabType]
  if (!strategy) {
    console.warn(`No strategy found for tabType: ${tabType}`)
    return null // TODO: what's the correct thing to do here?
  }
  return strategy
}

async function findMameDatContent(
  pathInTabData: string[],
  romname: string,
  mameNames: { mameName?: string; parentName?: string },
  mameUseParentForSrch: boolean,
  thisSystemsTab: string
): Promise<any> {
  console.log(pathInTabData)
  const tabType = thisSystemsTab.tabType
  //TODO: Do we ever have >1 path in for mame dats? What will happen if there's >1? does the code need fixing or the data?
  for (const p of pathInTabData) {
    const macPath = convertWindowsPathToMacPath(p)
    console.log('this systems tab type is: ', tabType)
    const strategy = getTabTypeStrategy(tabType)
    if (!strategy) {
      const msg = `Unknown tabType sent to mediaPanel: ${tabType}`
      console.log(msg)
      return { error: msg } //TODO: throw?
    }
    const { datLeafFilename, contentFinder } = strategy
    const mameDatPath = path.join(macPath, datLeafFilename)
    console.log('mameDatPath', mameDatPath)
    try {
      await fs.promises.stat(mameDatPath) // Check if mameDat exists
      //TODO: we're assuming this has been set to searchType: 'ExactMatch', which it should, is it always? if so the data needs fixing not the code
      let mameDatContent = await fs.promises.readFile(mameDatPath, 'utf8')
      return contentFinder(romname, mameNames, mameUseParentForSrch, mameDatContent)
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('Mame Dat file does not exist:', mameDatPath)
        continue //to the next dat in the array if the current dat doesn't exist or any error occurs
      } else {
        console.error('Error processing Mame Dat data:', error)
        return { error: 'Error processing Mame Dat data' }
      }
    }
  }
  return { error: 'Associated Mame-dat-style file not found for the provided ROM name' }
}

function cleanMameInfoContent(content: string): string {
  const lines = content.split(/\r?\n/)
  const cleanedLines = []
  let isSectionHeader = false
  let inList = false // Track if we are currently processing list items
  let listItems = [] // Temporarily store list items
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const isBlankLine = line.trim() === ''
    isSectionHeader =
      /^[A-Z].*:$/.test(line) ||
      line.startsWith('WIP') ||
      line.startsWith('LEVELS') ||
      line.startsWith('Other Emulators') ||
      line.startsWith('Artwork available') ||
      line.startsWith('Romset') ||
      line.startsWith('Recommended Games')
    if (isBlankLine) {
      continue
    }
    if (isSectionHeader && cleanedLines.length > 0) {
      // If exiting a list, close the <ul> tag before adding a section header
      if (inList) {
        cleanedLines.push(`<ul className="list-disc pl-4">${listItems.join('')}</ul>`)
        listItems = []
        inList = false
      }
      cleanedLines.push('')
    }
    if (isSectionHeader) {
      cleanedLines.push(`<strong>${line}</strong>`)
    } else if (line.startsWith('- ')) {
      // If the line starts with "- ", we're in a list
      if (!inList) {
        inList = true // Mark that we've started a list
      }
      listItems.push(`<li>${line.substring(2)}</li>`) // Add item to temporary list storage
    } else {
      // If exiting a list, close the <ul> tag before adding regular content
      if (inList) {
        cleanedLines.push(`<ul className="list-disc pl-4">${listItems.join('')}</ul>`)
        listItems = []
        inList = false
      }
      cleanedLines.push(line)
    }
  }
  // If there are any remaining list items after the loop, close the <ul> tag
  if (inList) {
    cleanedLines.push(`<ul>${listItems.join('')}</ul>`)
  }
  return cleanedLines.join('\n')
}

async function findMameInfoContent(
  romname: string,
  mameNames: { mameName?: string; parentName?: string },
  mameUseParentForSrch: boolean,
  mameDatContent: string
): Promise<any> {
  // Step 1 & 2: Split the content into lines and find the end of the comments section
  const lines = mameDatContent.split(/\r?\n/)
  const firstInfoIndex = lines.findIndex(line => line.startsWith('$info='))
  const fileHeader = lines.slice(0, firstInfoIndex).join('\n') // Isolate 'fileHeader'
  const trimmedContent = lines.slice(firstInfoIndex).join('\n') // Trim 'fileHeader' from content
  const entries = trimmedContent.split('$end')
  let matchFound = false // Flag to indicate a match has been found
  for (const entry of entries) {
    if (matchFound) break
    let searchTerms = [romname] // Default search term is romname
    if (mameNames.mameName) {
      searchTerms.unshift(mameNames.mameName) // If mameName is present, prioritize it
    }
    if (mameUseParentForSrch && mameNames.parentName) {
      searchTerms.push(mameNames.parentName) // If mameParent should be used and is present, add it
    }
    for (const searchTerm of searchTerms) {
      if (entry.includes(`$info=${searchTerm}`)) {
        matchFound = true
        const title = searchTerm
        const mameIndex = entry.indexOf('$mame') + 6
        const rawContent = entry.substring(mameIndex).trim()
        const content = cleanMameInfoContent(rawContent)
        const jsonContent = {
          title,
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

//original game history entries text bodies are line-width-separated, my fault! Remove unnecessary breaks keep real ones
function fixGameHistoryDatIssues(entry: string): { widthFixedContent: string; gameHistoryLink: string } {
  // This regex looks for a newline, followed by a space, and then another newline
  const entryWithUnSpacedNewlines = entry.replace(/ \n/g, '\n')
  //first fix the broken anchors
  // Correct and extract the link, all the game history links are tagged but malformed
  const linkMatch = entryWithUnSpacedNewlines.match(/\$<a href="([^"]+)"/m)
  const originalLink = linkMatch ? linkMatch[1] : ''
  const httpsLink = originalLink.replace('http://', 'https://') // Correcting the link
  const gameHistoryLink = `<a href="${httpsLink}">${httpsLink}</a>` // Correcting the malformed link
  let widthFixedContent: string
  const splitIndex = entryWithUnSpacedNewlines.indexOf('- TECHNICAL -')
  if (splitIndex !== -1) {
    const firstPart = entryWithUnSpacedNewlines.substring(0, splitIndex).trim()
    const secondPart = entryWithUnSpacedNewlines.substring(splitIndex) // Includes "- TECHNICAL -" and what follows
    const processedFirstPart = firstPart
      .split('\r\n\r\n')
      .map(paragraph => paragraph.replace(/\r\n/g, '±±±')) // Tag newlines
      .map(paragraph => paragraph.replace(/±±± ±±±/g, '\r\n\r\n')) // Restore the real paragraph breaks before...
      .map(paragraph => paragraph.replace(/±±±/g, '')) // ...removing the unwanted ones
      .join('\r\n\r\n')
      .trim()
    // Step 1: Wrap section keys in <b> tags
    let formattedSecondPart = secondPart.replace(/^(.+?)\s*:/gm, '<b>$1</b>:')
    // Step 2: Specifically replace "SOURCE:" with "Source:"
    formattedSecondPart = formattedSecondPart.replace('<b>SOURCE</b>:', '<b>Source</b>:')
    widthFixedContent = `${processedFirstPart}\r\n\r\n${formattedSecondPart}`
  } else {
    widthFixedContent = entryWithUnSpacedNewlines
  }
  return { widthFixedContent, gameHistoryLink }
}

//TODO: mamehistory also contains info about mess consoles!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//TODO: this is GAME History logic, we don't want to do so much munging for Mame history: we don't want to continue these non-isomporhic transformations, we lose list formattings etc
async function findHistoryDatContent(
  romname: string,
  mameNames: { mameName?: string; parentName?: string },
  mameUseParentForSrch: boolean,
  mameDatContent: string
): Promise<any> {
  // Step 1 & 2: Split the content into lines and find the end of the comments section
  const lines = mameDatContent.split(/\r?\n/)
  const firstInfoIndex = lines.findIndex(line => line.startsWith('$info='))
  const fileHeader = lines.slice(0, firstInfoIndex).join('\n') // Isolate 'fileHeader'
  const isGameHistory = fileHeader.includes('Matt McLemore') //is it a mame file or is it a game history file?
  const trimmedContent = lines.slice(firstInfoIndex).join('\n') // Trim 'fileHeader' from content
  const entries = trimmedContent.split('$end')
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
    // If isGameHistory, add a version of the game name with anything in brackets removed
    // TODO: add similar to other search types e.g.: screenshots
    if (isGameHistory) {
      const searchTermWithoutBrackets = romname.replace(/\s*\([^)]*\)/g, '').trim()
      searchTerms.push(searchTermWithoutBrackets)
    }
    for (const searchTerm of searchTerms) {
      //mame history entries are array like eg: $info=1944,1944d,
      //game history entries are the common-lanugage name of the game, not mamenames
      //added the '?' in the regex here, its not needed for history.dats as they always have trailing commas but command.dats do not
      //but even with that addition, the mame history regex still isn't suitable for gamehistory eg the ! in: Frogger 2 - Threedeep! (1984) (Parker Bros)
      if (
        isGameHistory
          ? entry.includes(`$info=${searchTerm},`)
          : new RegExp(`\\$info=.*\\b${searchTerm}\\b,?`).test(entry)
      ) {
        //fix game history issues, but not in real mame files!
        const { widthFixedContent, gameHistoryLink } = isGameHistory
          ? fixGameHistoryDatIssues(entry)
          : { widthFixedContent: entry, gameHistoryLink: null }
        matchFound = true
        // Find the index of `$bio` and then the title after the next newline
        const bioIndex = widthFixedContent.indexOf('$bio') + 4
        let titleStartIndex = widthFixedContent.indexOf('\n', bioIndex) + 1 // Start of the title
        // a lot of munging to try and separate the title from the section headings etc, mostly game-history specific problems (line endings may be \n\r etc)
        // Skip initial line breaks
        while (widthFixedContent[titleStartIndex] === '\n' || widthFixedContent[titleStartIndex] === '\r') {
          titleStartIndex++
        }
        // Find the earliest of the double line break or "- TECHNICAL -"
        let titleEndIndex = widthFixedContent.indexOf('\n\n', titleStartIndex)
        let technicalIndex = widthFixedContent.indexOf('- TECHNICAL -', titleStartIndex)
        if (technicalIndex !== -1 && (technicalIndex < titleEndIndex || titleEndIndex === -1)) {
          titleEndIndex = technicalIndex
        } else if (titleEndIndex === -1) {
          titleEndIndex = widthFixedContent.length // Fallback if no double line break is found
        }
        const title = widthFixedContent.substring(titleStartIndex, titleEndIndex).trim()
        // Adjust content to start after the title's end, ensuring it doesn't repeat the title
        const contentStartIndex = titleEndIndex + 2 // Skip the double newline after the title
        //now change headings from the garish "- ALLCAPS -/n" to Strongs
        const contentBeforeTagging = widthFixedContent.substring(contentStartIndex).trim()
        const content = contentBeforeTagging.replace(/^- ([A-Z\s]+) -\n$/gm, (match, p1) => {
          // Split the matched group into words, capitalize each, then join back together
          const initialCaps = p1
            .toLowerCase()
            .split(/\s+/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
          return `<strong>${initialCaps}</strong>`
        })
        // Construct the JSON object
        const jsonContent = {
          title,
          gameHistoryLink,
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

async function findMameCommandContent(
  romname: string,
  mameNames: { mameName?: string; parentName?: string },
  mameUseParentForSrch: boolean,
  mameDatContent: string
): Promise<any> {
  const lines = mameDatContent.split(/\r?\n/)
  const firstInfoIndex = lines.findIndex(line => line.startsWith('$info='))
  const fileHeader = lines.slice(0, firstInfoIndex).join('\n') // Isolate 'fileHeader'
  const trimmedContent = lines.slice(firstInfoIndex).join('\n') // Trim 'fileHeader' from content
  const entries = trimmedContent.split('$end')
  let matchFound = false
  for (const entry of entries) {
    if (matchFound) break
    let searchTerms = [romname] // Default search term is romname
    if (mameNames.mameName) {
      searchTerms.unshift(mameNames.mameName) // If mameName is present, prioritize it
    }
    if (mameUseParentForSrch && mameNames.parentName) {
      searchTerms.push(mameNames.parentName) // If mameParent should be used and is present, add it
    }
    for (const searchTerm of searchTerms) {
      //info is array-like, but unlike history.dat we don't have trailing commas!
      //the ? in this regex, combined with the \\b, may make it universally suitable
      if (new RegExp(`\\$info=.*\\b${searchTerm}\\b,?`).test(entry)) {
        matchFound = true
        //these are the heading delims - headings have these top (with newline after), and bottom
        const sectionPattern = /\*-{61}\*\n*(.*)\n*\*-{61}\*\n*/g
        const contentTypeIndex = entry.indexOf('$cmd') + 4
        let content = entry.substring(contentTypeIndex).trim()
        // Process and replace each matched section
        content = content.replace(sectionPattern, (match, headingText) => {
          headingText = headingText.trim()
          // Check if the heading text is enclosed by guillemets
          if (headingText.startsWith('«') && headingText.endsWith('»')) {
            // Replace guillermots with <strong> tags and return the processed section
            return `\n<strong>${headingText.slice(1, -1)}</strong>\n`
          } else {
            // Wrap the heading text with <i> tags and return the processed section
            return `\n<u>${headingText}\n</u>`
          }
        })
        const newHeadingPattern = /:(.*?):\n/g
        content = content.replace(newHeadingPattern, (match, headingText) => {
          return `<i>${headingText.trim()}</i>\n`
        })
        //now its safe to remove the trailing star line. Don't reuse any previous index now as content's changed (could just cut the last line off the content instead)
        content = content.replace(/\*-{61}\*/g, '').trim()
        //now we've removed those star lines, the title's the first populated line
        let titleStartIndex = 0
        while (content[titleStartIndex] === '\n' || content[titleStartIndex] === '\r') {
          titleStartIndex++
        }
        let titleEndIndex = content.indexOf('\n\n', titleStartIndex)
        const title = content.substring(titleStartIndex, titleEndIndex).trim()
        // Adjust content to start after the title's end, ensuring it doesn't repeat the title
        const contentStartIndex = titleEndIndex + 2 // Skip the double newline after the title
        content = content.substring(contentStartIndex).trim()
        const jsonContent = {
          title,
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

async function findMameGameInitContent(
  romname: string,
  mameNames: { mameName?: string; parentName?: string },
  mameUseParentForSrch: boolean,
  mameDatContent: string
): Promise<any> {
  const lines = mameDatContent.split(/\r?\n/)
  const firstInfoIndex = lines.findIndex(line => line.startsWith('$info='))
  const fileHeader = lines.slice(0, firstInfoIndex).join('\n') // Isolate 'fileHeader'
  const trimmedContent = lines.slice(firstInfoIndex).join('\n') // Trim 'fileHeader' from content
  const entries = trimmedContent.split('$end')
  let matchFound = false
  for (const entry of entries) {
    if (matchFound) break
    let searchTerms = [romname] // Default search term is romname
    if (mameNames.mameName) {
      searchTerms.unshift(mameNames.mameName) // If mameName is present, prioritize it
    }
    if (mameUseParentForSrch && mameNames.parentName) {
      searchTerms.push(mameNames.parentName) // If mameParent should be used and is present, add it
    }
    for (const searchTerm of searchTerms) {
      if (new RegExp(`\\$info=.*\\b${searchTerm}\\b,?`).test(entry)) {
        matchFound = true
        const contentTypeIndex = entry.indexOf('$mame') + 5
        let content = entry.substring(contentTypeIndex).trim()
        const title = searchTerm //note: this dat has specific instructions per machine, so if we return a parent's result, it may not be valid, hence use the mamename to show which mame rom we're talking about
        //this one had just HEADINGS: surrounded by whitespace
        const sectionPattern = /^\s*([A-Z ]+):\s*$/gm
        content = content.replace(sectionPattern, (match, headingText) => {
          // Split the heading text into words, capitalize the first letter of each word,
          // convert the rest to lowercase, then join the words back together.
          const capitalizedHeading = headingText
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ')
          return `<strong>${capitalizedHeading}</strong>`
        })
        const jsonContent = {
          title,
          content
        }
        console.log('jsonContent')
        console.log(jsonContent)
        return jsonContent
      }
    }
  }
  return { error: 'Mame Game Init entry not found for the provided ROM name' }
}

async function findMameStoryContent(
  romname: string,
  mameNames: { mameName?: string; parentName?: string },
  mameUseParentForSrch: boolean,
  mameDatContent: string
): Promise<any> {
  const lines = mameDatContent.split(/\r?\n/)
  const firstInfoIndex = lines.findIndex(line => line.startsWith('$info='))
  const fileHeader = lines.slice(0, firstInfoIndex).join('\n') // Isolate 'fileHeader'
  const trimmedContent = lines.slice(firstInfoIndex).join('\n') // Trim 'fileHeader' from content
  const entries = trimmedContent.split('$end')
  let matchFound = false
  for (const entry of entries) {
    if (matchFound) break
    let searchTerms = [romname] // Default search term is romname
    if (mameNames.mameName) {
      searchTerms.unshift(mameNames.mameName) // If mameName is present, prioritize it
    }
    if (mameUseParentForSrch && mameNames.parentName) {
      searchTerms.push(mameNames.parentName) // If mameParent should be used and is present, add it
    }
    for (const searchTerm of searchTerms) {
      if (new RegExp(`\\$info=.*\\b${searchTerm}\\b,?`).test(entry)) {
        matchFound = true
        const contentTypeIndex = entry.indexOf('$story') + 6
        let content = entry.substring(contentTypeIndex).trim()
        content = content.replace(/MAMESCORE records : (.*)\n/, `<strong>Mamescore Records: $1</strong>\n`)
        const title = searchTerm
        const jsonContent = {
          title,
          content
        }
        console.log('jsonContent')
        console.log(jsonContent)
        return jsonContent
      }
    }
  }
  return { error: 'Mame Game Init entry not found for the provided ROM name' }
}

async function findMameMessInfoContent(
  romname: string,
  mameNames: { mameName?: string; parentName?: string },
  mameUseParentForSrch: boolean,
  mameDatContent: string
): Promise<any> {
  const lines = mameDatContent.split(/\r?\n/)
  const firstInfoIndex = lines.findIndex(line => line.startsWith('$info='))
  const fileHeader = lines.slice(0, firstInfoIndex).join('\n') // Isolate 'fileHeader'
  const trimmedContent = lines.slice(firstInfoIndex).join('\n') // Trim 'fileHeader' from content
  let searchTerms = [romname] // Default search term is romname
  if (mameNames.mameName) {
    searchTerms.unshift(mameNames.mameName) // If mameName is present, prioritize it
  }
  if (mameUseParentForSrch && mameNames.parentName) {
    searchTerms.push(mameNames.parentName) // If mameParent should be used and is present, add it
  }
  const entries = trimmedContent.split('$end')
  let matchFound = false
  for (const searchTerm of searchTerms) {
    if (matchFound) break
    for (const entry of entries) {
      console.log('searchTerm', searchTerm)
      if (new RegExp(`\\$info=.*\\b${searchTerm}\\b,?`).test(entry)) {
        matchFound = true
        const contentTypeIndex = entry.indexOf('$mame') + 5
        let content = entry.substring(contentTypeIndex).trim()
        const title = searchTerm //note: this dat has specific instructions per machine, so if we return a parent's result, it may not be valid, hence use the mamename to show which mame rom we're talking about
        //this one had just HEADINGS: surrounded by whitespace
        const sectionPattern = /^\s*([A-Z ]+):\s*$/gm
        content = content.replace(sectionPattern, (match, headingText) => {
          // Split the heading text into words, capitalize the first letter of each word,
          // convert the rest to lowercase, then join the words back together.
          const capitalizedHeading = headingText
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ')
          return `\n<strong>${capitalizedHeading}</strong>` //note \n need it in this one?!?
        })
        const jsonContent = {
          title,
          content
        }
        console.log('jsonContent')
        console.log(jsonContent)
        return jsonContent
      }
    }
  }
  return { error: 'Mame Game Init entry not found for the provided ROM name' }
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
  mameNames: { mameName?: string; parentName?: string } = {},
  mameUseParentForSrch: boolean
) {
  console.log(`using searchType ${searchType}`)
  const foundBase64Files = new Set()
  const macPaths = pathInTabData.map(p => convertWindowsPathToMacPath(p))
  const mameNameSearchTerms = [mameNames.mameName, mameUseParentForSrch && mameNames.parentName].filter(Boolean)
  const shouldSearchRomNameOnly = Object.keys(mameNames).length === 0 || (!mameNames.mameName && !mameNames.parentName)
  for (const macPath of macPaths) {
    try {
      const files = await fs.promises.readdir(macPath)
      const fileProcessingPromises = files.map(async file => {
        let matchFound = false
        if (!shouldSearchRomNameOnly) {
          for (const searchTerm of mameNameSearchTerms) {
            if (searchStrategies(file, searchTerm, searchType)) matchFound = true
          }
        }
        // Perform romname search if no mameNames exist or if neither search was successful
        if (shouldSearchRomNameOnly || !matchFound) {
          if (searchStrategies(file, romname, searchType)) matchFound = true
        }
        if (matchFound) {
          const filePath = path.join(macPath, file)
          const fileData = await fs.promises.readFile(filePath)
          const ext = path.extname(file).toLowerCase()
          const mimeType = getMimeType(ext)
          if (mimeType !== null) {
            const base64File = `data:${mimeType};base64,${fileData.toString('base64')}`
            foundBase64Files.add(base64File)
          }
        }
      })
      await Promise.all(fileProcessingPromises)
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
    } else if (tabClass === 'mameDat') {
      const mameDat = await findMameDatContent(pathInTabData, romname, mameNames, mameUseParentForSrch, thisSystemsTab)
      console.log('mameDat content:', mameDat)
      return { mameDat }
    } else {
      return {}
    }
  } else {
    console.error(`Error: Screenshot path is not defined for system: ${system}`)
    return {}
  }
}
