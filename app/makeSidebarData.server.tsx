import { promises as fsPromises } from 'fs'
import path from 'path'
import { loadIconBase64 } from './loadImages.server'

let idCounter = 1

export async function scanFolder(folderPath) {
  const items = await fsPromises.readdir(folderPath)

  const folders = await Promise.all(
    items.map(async item => {
      const itemPath = path.join(folderPath, item)
      const stats = await fsPromises.stat(itemPath)
      if (!stats.isDirectory()) {
        return null
      }
      const children = await scanFolder(itemPath)
      const folderInfoPath = path.join(itemPath, 'folderInfo.json')
      const romdataPath = path.join(itemPath, 'romdata.json')
      let icon = null
      let iconLink = null
      let romdataLink = null

      try {
        await fsPromises.access(folderInfoPath)
        const folderInfo = JSON.parse(await fsPromises.readFile(folderInfoPath, 'utf-8'))
        iconLink = folderInfo.folderInfo.iconLink
        icon = await loadIconBase64(iconLink)
        if (icon === undefined) {
          throw new Error(`Icon not found for ${iconLink}`)
        }
      } catch (err) {
        console.error(`Error reading folderInfo.json: ${err}`)
      }

      try {
        await fsPromises.access(romdataPath)
        romdataLink = path.join(romdataPath)
      } catch (err) {
        // If romdata.json doesn't exist, we simply skip setting romdataLink
      }

      const folder = {
        id: `${idCounter++}`, //need to use string ids for react-arborist
        name: item,
        iconLink, //theoretically not needed if we have the icon itself
        icon,
        romdataLink,
        children: children.length > 0 ? children : undefined
      }

      return folder
    })
  )

  return folders.filter(Boolean) // filter out null values
}
