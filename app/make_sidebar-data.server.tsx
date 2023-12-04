import fs from 'fs'
import path from 'path'
import { loadIconBase64 } from './load_images.server'

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
      //console.log(process.cwd())
      const folderInfoPath = path.join(itemPath, 'folderInfo.json')
      const romdataPath = path.join(itemPath, 'romdata.json')
      let icon = null
      let iconLink = null
      let romdataLink = null
      if (fs.existsSync(folderInfoPath)) {
        // console.log('found folderInfo.json')
        const folderInfo = require(path.join(process.cwd(), folderInfoPath))
        // console.log('folderInfo', folderInfo)
        iconLink = path.join('Icons', folderInfo.folderInfo.iconLink)
        icon = loadIconBase64(iconLink)
        // console.log('iconLink', iconLink)
      }
      // console.log('romdataPath', romdataPath)
      if (fs.existsSync(romdataPath)) {
        // console.log('yeah its there')
        romdataLink = path.join(romdataPath)
      } //TODO: what action if it doesn't exist?

      return children.length > 0
        ? {
            id: `${idCounter++}`, //need to use string ids for react-arborist
            name: item,
            iconLink, //theoretically not needed if we have the icon itself
            icon,
            romdataLink, //TODO: I think parents can have romdata?
            children
          }
        : {
            id: `${idCounter++}`,
            name: item,
            iconLink,
            icon,
            romdataLink
          }
    })

  return folders
}
