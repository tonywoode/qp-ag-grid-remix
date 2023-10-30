import fs from 'fs'
import path from 'path'

let idCounter = 1

export function scanFolder(folderPath) {
  const items = fs.readdirSync(folderPath)

  return items.map(item => {
    const itemPath = path.join(folderPath, item)
    const stats = fs.statSync(itemPath)

    if (stats.isDirectory()) {
      return {
        id: idCounter++,
        name: item,
        children: scanFolder(itemPath)
      }
    } else {
      return {
        id: idCounter++,
        name: item,
        children: []
      }
    }
  })
}
