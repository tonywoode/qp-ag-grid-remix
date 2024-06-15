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

export async function loadTabData(screenshots: string, system: string) {
  console.log('load screenshosts server passed ' + system + ' ' + screenshots)
  const thisSystemsTabs = mediaPanelConfig?.[system]?.tabs
  console.log(thisSystemsTabs)
  //we'll need to return a list of the tabnames for the tab component to generate
  const tabNames = thisSystemsTabs?.map(tab => tab.caption)
  //but that's not enough, we need to essentially return the tabs dataStructure but instead of paths, we'll return the found images
  //but what then happens when we need access later to the paths themselves? Maybe its better to return the data structure as is, but include a foundImages prop for those paths that were found
  //or just do another call to find and load, we're too far from single responsibility here...
  console.log('tabNames is ' + tabNames)
  const screenshotTab = thisSystemsTabs?.find(tab => tab.caption === 'ScreenShots')
  console.log(screenshotTab)
  const screenshotPath = screenshotTab ? screenshotTab.path : null
  console.log('screenshot path is ' + screenshotPath)
  if (screenshotPath) {
    const base64Files = await findScreenshotPaths(screenshots, screenshotPath)
    console.log('Found files:', base64Files)
    return { tabNames, screenshots: base64Files }
  } else {
    console.error(`Error: Screenshot path is not defined for system: ${system}`)
    return {}
  }
}
