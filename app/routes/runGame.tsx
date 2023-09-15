import { ActionArgs, json } from '@remix-run/node'

const Seven = require('node-7z')

export async function action({ request }: ActionArgs) {
  const body = await request.json()

  console.log(body)
  const runGameIfItsGotDefaultGoodmerge = (path, defaultGoodMerge) => {
    console.log(path, defaultGoodMerge)

    //hardcoode to demonstrate extracting defaultGoodmerge
    const archivePath = '/Volumes/Untitled/Games/Sega Games/Genesis Games/GoodGEN_3_GM/Atomic Robo-Kid.7z'
    const filePathInsideArchive = 'Atomic Robo-Kid (U) [c][!].gen'
    const outputDirectory = '~/../temp'
    const options = {
      recursive: true, // extract subdirectories as well
      $cherryPick: filePathInsideArchive // Specify the file you want to extract
    }
    Seven.extractFull(archivePath, outputDirectory, options, (err, files) => {
      if (err) {
        console.error(`Error extracting archive: ${err}`)
        return
      }

      console.log('Extraction complete')
      // Now you can pass the extracted file to another program

      // Clean up the temporary extracted file if needed
    })
  }
  runGameIfItsGotDefaultGoodmerge()
  console.log('yep you hit me')
  return null
}
