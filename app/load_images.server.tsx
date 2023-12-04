import fs from 'fs'
import path from 'path'

export const loadIconBase64 = iconPath => {
  //console.log('iconPath', iconPath)
  //currently many icons are missing because in qp the mess ini file is read, the icons are grabbed from it, and they are loaded and concatted to qp's icons
  try {
    const filePath = path.join(process.cwd(), 'assets', iconPath)
    if (!fs.existsSync(filePath)) {
      console.error(`Error: Icon file does not exist: ${iconPath}`)
      return null
    }
    const fileData = fs.readFileSync(filePath)
    return `data:image/png;base64,${fileData.toString('base64')}`
  } catch (error) {
    console.error(`Error: Failed to load icon: ${iconPath}`, error)
    return null
  }
}
