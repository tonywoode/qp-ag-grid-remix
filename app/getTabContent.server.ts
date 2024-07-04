import fs from 'fs'
import path from 'path'
import { convertWindowsPathToMacPath } from '~/utils/OSConvert.server'

async function findHistoryDatContent(pathInTabData: string[], romname: string): Promise<string> {
  for (const p of pathInTabData) {
    const macPath = convertWindowsPathToMacPath(p)
    try {
      const historyDatPath = path.join(macPath, 'History.dat')
      const historyExists = await fs.promises
        .stat(historyDatPath)
        .then(() => true)
        .catch(() => false)
      if (historyExists) {
        console.log('History.dat exists in directory:', macPath)
        let historyContent = await fs.promises.readFile(historyDatPath, 'utf8')
        // Find the index of the first $info marker
        const firstInfoIndex = historyContent.indexOf('$info=')
        // If $info marker is found, substring from this index
        if (firstInfoIndex !== -1) {
          historyContent = historyContent.substring(firstInfoIndex)
        }
        const entries = historyContent.split('$end')
        console.log('looking for ' + romname)
        for (const entry of entries) {
          if (entry.includes(`$info=${romname},`)) {
            let processedEntry = entry.trim() // Trim the entry of whitespace
            processedEntry = processedEntry.replace(/^\$info=/, '') // Remove $info= from the first line
            processedEntry = processedEntry.replace(/^\$<a/m, '<a') // Remove $ from the start of the href line in a multiline string
            processedEntry = processedEntry.replace(/\$bio\s*/, '') // Remove $bio from the third line
            return processedEntry
          }
        }
      }
    } catch (error) {
      console.error(`Error reading History.dat in directory ${macPath}: ${error}`)
    }
  }
  return 'History entry not found for the provided ROM name.'
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
      const historyContent = await findHistoryDatContent(pathInTabData, romname)
      console.log('History.dat content:', historyContent)
      return { history: historyContent }
    } else {
      return {}
    }
  } else {
    console.error(`Error: Screenshot path is not defined for system: ${system}`)
    return {}
  }
}
