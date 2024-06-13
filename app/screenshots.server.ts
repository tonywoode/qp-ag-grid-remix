import fs from 'fs'
import path from 'path'
import mediaPanelConfig from '~/../dats/mediaPanelConfig.json'
import { convertWindowsPathToMacPath } from '~/utils/OSConvert.server'

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

export async function loadScreenshots(screenshots: string, system: string) {
  console.log('load screenshosts server passed ' + system + ' ' + screenshots)
  const thisSystemsTabs = mediaPanelConfig?.[system]?.tabs
  console.log(thisSystemsTabs)
  const screenshotTab = thisSystemsTabs.find(tab => tab.caption === 'ScreenShots')
  console.log(screenshotTab)
  const screenshotPath = screenshotTab ? screenshotTab.path : null
  console.log('screenshot path is ' + screenshotPath)
  if (screenshotPath) {
    const base64Files = await findScreenshotPaths(screenshots, screenshotPath)
    console.log('Found files:', base64Files)
    return { screenshots: base64Files }
  } else {
    console.error(`Error: Screenshot path is not defined for system: ${system}`)
    return {}
  }
}
