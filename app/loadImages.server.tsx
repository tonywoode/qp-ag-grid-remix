import fs from 'fs'
import path from 'path'
import { logger } from './root'
import { systemPaths, internalPaths } from '~/config/gamePaths.server'

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
    const internalPath = path.resolve(__dirname, '../assets', internalPaths.icons, iconName)
    let finalPath = internalPath
    let exists = await fileExists(internalPath)

    if (!exists) {
      const externalPath = path.join(systemPaths.mameExtras, iconName)
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