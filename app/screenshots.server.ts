import { promises as fs } from 'fs'

export async function loadScreenshots() {
  const filePath = '/Volumes/Untitled/Emulators/SCREENSHOTS/Nintendo N64/GoodN64_314_GM_Screens/64 Oozumou.png'
  const file = await fs.readFile(filePath)
  const base64File = `data:image/png;base64,${file.toString('base64')}`

  return { screenshots: [base64File] }
}
