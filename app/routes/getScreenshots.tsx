import { promises as fs } from 'fs'
export async function action({ request }: ActionArgs) {
  const screenshots = await request.json()
  console.log('you sent me screenshots' + screenshots)
  const filePath = '/Volumes/Untitled/Emulators/SCREENSHOTS/Nintendo N64/GoodN64_314_GM_Screens/' + screenshots + '.png'
  // const filePath = '/Volumes/Untitled/Emulators/SCREENSHOTS/Nintendo N64/GoodN64_314_GM_Screens/64 Oozumou.png'
  const file = await fs.readFile(filePath)
  const base64File = `data:image/png;base64,${file.toString('base64')}`

  return { screenshots: [base64File] }
}
