import fs from 'fs'

export async function action({ request }: ActionArgs) {
  const screenshots = await request.json()
  console.log('you requested screenshot ' + screenshots)
  const filePath = '/Volumes/Untitled/Emulators/SCREENSHOTS/Nintendo N64/GoodN64_314_GM_Screens/' + screenshots + '.png'

  if (!fs.existsSync(filePath)) {
    console.error(`Error: File does not exist: ${filePath}`)
    return {}
  }

  const file = await fs.promises.readFile(filePath)
  const base64File = `data:image/png;base64,${file.toString('base64')}`

  return { screenshots: [base64File] }
}
