import { ActionArgs, json } from '@remix-run/node'
//import { extractArchive } from 'node-7z-archive'

export async function action({ request }: ActionArgs) {
  const body = await request.json()

  console.log(body)
  const runGameIfItsGotDefaultGoodmerge = async (path, defaultGoodMerge) => {
    console.log(path, defaultGoodMerge)

    //hardcoode to demonstrate extracting defaultGoodmerge
    const archivePath = '/Volumes/Untitled/Games/Sega Games/Genesis Games/GoodGEN_3_GM/Atomic Robo-Kid.7z'
    const filePathInsideArchive = 'Atomic Robo-Kid (U) [c][!].gen'
    const outputDirectory = '/Users/twoode/CODE/Scripts/qp-ag-grid/qp-ag-grid-remix/qp-ag-grid-remix/temp'

    //its an ESM module, use dynamic import inline here, don't try adding it to the serverDependenciesToBundle in remix.config.js, that won't work
    const node7z = await import('node-7z-archive')
    //const node7z = moduleA.default()
    //console.log(node7z)
    const { extractArchive } = node7z
    await extractArchive(archivePath, outputDirectory)
      .then(result => {
        console.log(result)
      })
      .catch(err => {
        console.log(err)
      })
  }
  //     const options = {
  //       recursive: true, // extract subdirectories as well
  //       $cherryPick: filePathInsideArchive // Specify the file you want to extract
  //     }
  //     Seven.extractFull(archivePath, outputDirectory, options, (err, files) => {
  //       if (err) {
  //         console.error(`Error extracting archive: ${err}`)
  //         return
  //       }

  //       console.log('Extraction complete')
  //       // Now you can pass the extracted file to another program

  //       // Clean up the temporary extracted file if needed
  //     })
  //   }
  runGameIfItsGotDefaultGoodmerge()
  console.log('yep you hit me')
  return null
}
