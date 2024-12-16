import fs from 'fs'
import path from 'path'
import { logger } from './root'

export const loadMameIconBase64 = async (mameName, parentName) => {
  const iconPaths = [`./${mameName}.ico`, `./${parentName}.ico`]

  for (const iconPath of iconPaths) {
    logger.log('icons', 'lets try to load icon', iconPath)
    const filePath = path.resolve(__dirname, '/Volumes/Untitled/Games/MAME/EXTRAs/icons/', iconPath)
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
