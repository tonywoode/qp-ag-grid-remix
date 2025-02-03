import fs from 'fs'
import path from 'path'
import { logger } from './root'

// TODO: make these configurable via UI/env
const externalIconsPath = '/Volumes/Untitled/Games/MAME/EXTRAs/icons'
const internalIconsDir = 'Icons' // capital I for internal path

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath)
    return true
  } catch {
    return false
  }
}

export const loadIconBase64 = async (iconName: string) => {
  try {
    // First try internal path (with capital I)
    const internalPath = path.resolve(__dirname, '../assets', internalIconsDir, iconName)
    let finalPath = internalPath
    let exists = await fileExists(internalPath)

    // If not in internal path, try external path
    if (!exists) {
      const externalPath = path.join(externalIconsPath, iconName)
      exists = await fileExists(externalPath)
      if (exists) {
        finalPath = externalPath
      }
    }

    if (!exists) {
      logger.log(`screenshots`, `Error: Icon not found in either location: ${iconName}`)
      return null
    }

    const fileData = await fs.promises.readFile(finalPath)
    return `data:image/png;base64,${fileData.toString('base64')}`
  } catch (error) {
    logger.log(`screenshots`, `Error: Failed to load icon: ${iconName}`, error)
    return null
  }
}