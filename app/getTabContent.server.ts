import fs from 'fs'
import path from 'path'
import { convertWindowsPathToMacPath } from '~/utils/OSConvert.server'

async function findHistoryDatContent(pathInTabData: string[], romname: string): Promise<any> {
  for (const p of pathInTabData) {
    const macPath = convertWindowsPathToMacPath(p)
    try {
      const historyDatPath = path.join(macPath, 'History.dat')
      const historyExists = await fs.promises
        .stat(historyDatPath)
        .then(() => true)
        .catch(() => false)
      if (historyExists) {
        let historyContent = await fs.promises.readFile(historyDatPath, 'latin1') // Note latin1 for history.dats
        const entries = historyContent.split('$end')
        for (const entry of entries) {
          if (entry.includes(`$info=${romname},`)) {
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
    } catch (error) {
      console.error('Error processing history data:', error)
    }
  }
  return { error: 'History entry not found for the provided ROM name.' }
}

async function findScreenshotPaths(screenshotName: string, screenshotPaths: string[]) {
  const foundFiles = []

  for (const p of screenshotPaths) {
    const macPath = convertWindowsPathToMacPath(p)
    try {
      const files = await fs.promises.readdir(macPath)
      const foundFile = files.find(file => file.includes(screenshotName))
      if (foundFile) {
        const filePath = path.join(macPath, foundFile)
        const file = await fs.promises.readFile(filePath)
        const ext = path.extname(foundFile).toLowerCase()
        const mimeTypes: { [key: string]: string } = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.bmp': 'image/bmp',
          '.ico': 'image/x-icon'
        }
        const mimeType = mimeTypes[ext] || 'application/octet-stream'
        const base64File = `data:${mimeType};base64,${file.toString('base64')}`
        foundFiles.push(base64File)
      }
    } catch (error) {
      console.error(`Error reading directory ${macPath}: ${error}`)
    }
  }

  return foundFiles
}

export async function getTabContent(tabType, romname, thisSystemsTab, system) {
  const tabData = thisSystemsTab
  console.log(tabData)
  const pathInTabData = tabData ? tabData.path : null
  console.log('Path in tabData is ' + pathInTabData)
  if (pathInTabData) {
    if (tabType === 'screenshot') {
      const base64Files = await findScreenshotPaths(romname, pathInTabData)
      console.log('Found files:', base64Files)
      return { screenshots: base64Files }
    } else if (tabType === 'history') {
      const history = await findHistoryDatContent(pathInTabData, romname)
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
