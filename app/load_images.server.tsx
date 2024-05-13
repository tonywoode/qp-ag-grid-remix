import fs from 'fs'
import path from 'path'

export const loadIconBase64 = async iconPath => {
  try {
    const filePath = path.resolve(__dirname, '../assets', iconPath)
    if (!fs.existsSync(filePath)) {
      console.error(`Error: Image File does not exist: ${filePath}`)
      return null
    }

    const fileData = await fs.promises.readFile(filePath)
    return `data:image/png;base64,${fileData.toString('base64')}`
  } catch (error) {
    console.error(`Error: Failed to load icon: ${iconPath}`, error)
    return null
  }
}