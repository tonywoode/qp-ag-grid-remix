import fs from 'fs'
import path from 'path'

let idCounter = 1

export function scanFolder(folderPath) {
  const items = fs.readdirSync(folderPath)

  const folders = items
    .filter(item => {
      const itemPath = path.join(folderPath, item)
      const stats = fs.statSync(itemPath)
      return stats.isDirectory()
    })
    .map(item => {
      const itemPath = path.join(folderPath, item)
      const children = scanFolder(itemPath)

      return children.length > 0
        ? {
            id: `${idCounter++}`,
            name: item,
            children
          }
        : {
            id: `${idCounter++}`,
            name: item
          }
    })

  return folders
}
