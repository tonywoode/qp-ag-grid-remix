import fs from 'fs'
import path from 'path'

export const loadIconBase64 = async iconPath => {
  try {
    const filePath = path.resolve(__dirname, '../assets', iconPath)
    const fileData = await fs.promises.readFile(filePath)
    return `data:image/png;base64,${fileData.toString('base64')}`
  } catch (error) {
    //currently many icons are missing because in qp the mess ini file is read, the icons are grabbed from it, and they are loaded and concatted to qp's icons
    //console.error(`Error: Failed to load icon: ${iconPath}`, error)
    return null
  }
}
