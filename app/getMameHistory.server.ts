import fs from 'fs'
import path from 'path'
import { convertWindowsPathToMacPath } from '~/utils/OSConvert.server'

import fs from 'fs'
import path from 'path'
import { convertWindowsPathToMacPath } from '~/utils/OSConvert.server'

async function findHistoryDatContent(screenshotPaths: string[], romname: string): Promise<string> {
  for (const p of screenshotPaths) {
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

export async function getTabImages(romname, thisSystemsTab, system) {
  console.log(' we got here')
  const screenshotTab = thisSystemsTab
  console.log(screenshotTab)
  const screenshotPath = screenshotTab ? screenshotTab.path : null
  console.log('screenshot path is ' + screenshotPath)
  if (screenshotPath) {
    const historyContent = await findHistoryDatContent(screenshotPath, romname)
    console.log('History.dat content:', historyContent)
    return { history: historyContent }
  } else {
    console.error(`Error: Screenshot path is not defined for system: ${system}`)
    return {}
  }
}
