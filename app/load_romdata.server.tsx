import fs from 'fs'
import path from 'path'

export function loadRomdata(romdataPathStarred) {
  console.log('romdataPathStarred in load romdata is....', romdataPathStarred)
  //swap the * back to / for the path
  const romdataPath = romdataPathStarred.replace(/\*/g, '/')
  //add the cwd to the path
  const romdataPathFull = path.join(process.cwd(), romdataPath)
  console.log('romdataPathFull in load romdata is....', romdataPathFull)
  //use fs.readFileSync to load the path
  const romdataRaw = fs.readFileSync(romdataPathFull, 'utf8')
  // romdata is json, so parse it
  const romdata = JSON.parse(romdataRaw)
  console.log('romdata in load romdata is....', romdata)
  return romdata
}
