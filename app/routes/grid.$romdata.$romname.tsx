import { useLoaderData } from '@remix-run/react'
import type { LoaderFunctionArgs } from '@remix-run/node'
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs'
import { ScreenshotsTab } from '~/components/ScreenshotsTab'
import { loadScreenshots } from '~/screenshots.server'

export async function loader({ params }: LoaderFunctionArgs) {
  console.log('grid romdata romname loader')
  const romname = params.romname ?? ''
  console.log(params)
  console.log('in the loader romname is ' + romname)
  const romnameNoParens = romname.replace(/\(.*\)/g, '').trim()
  const gottenScreenshots = await loadScreenshots(romnameNoParens)
  const screenshots = gottenScreenshots.screenshots
  return { screenshots }
}

export default function MediaPanel() {
  const data = useLoaderData()
  const screenshots = data.screenshots

  return (
    <Tabs>
      <TabList>
        <Tab>Screenshots</Tab>
        <Tab>Game Info</Tab>
      </TabList>

      <TabPanel>
        <ScreenshotsTab screenshots={screenshots} />
      </TabPanel>
      <TabPanel>
        <h2>Good Game, son</h2>
      </TabPanel>
    </Tabs>
  )
}
  /* {isRomSelected && <MediaPanel screenshots={base64Image ? [base64Image] : []}>{screenshotUrl}</MediaPanel>} */
  /* <div>{screenshotUrl}</div> */

// export default function gameFile() {
// const params = useParams()
// const romname = decodeURI(params.romname)
// console.log(`/mypath/${romname}`)
// return <div>{romname}</div>
// }
