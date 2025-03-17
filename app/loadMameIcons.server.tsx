import fs from 'fs'
import path from 'path'
import { logger } from '~/dataLocations.server'
import { systemPaths } from '~/config/gamePaths.server'
import { userPaths } from '~/config/userPaths'

export const loadMameIconBase64 = async (mameName, parentName) => {
  const iconPaths = [`./${mameName}.ico`, `./${parentName}.ico`]

  // TEMPORARY: Use user-specified MAME extras path if available, otherwise fall back to system path
  const mameExtrasPath = userPaths.mameExtras || systemPaths.mameExtras

  for (const iconPath of iconPaths) {
    logger.log('icons', 'lets try to load icon', iconPath)
    const filePath = path.resolve(mameExtrasPath, iconPath)
    try {
      if (fs.existsSync(filePath)) {
        const fileData = await fs.promises.readFile(filePath)
        return `data:image/x-icon;base64,${fileData.toString('base64')}`
      } else {
        logger.log('icons', `Error: Icon file does not exist: ${filePath}`)
      }
    } catch (error) {
      console.error('icons', `Error: Failed to load icon: ${iconPath}`, error)
    }
  }

  return null
}
