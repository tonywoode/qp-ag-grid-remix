import { useLoaderData /*,useRouteLoaderData*/ } from '@remix-run/react'
// import { type loader as gridLoader } from 'grid.$romdata.tsx'
import type { LoaderFunctionArgs } from '@remix-run/node'
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs'
import { ScreenshotsTab } from '~/components/ScreenshotsTab'
import { loadTabData } from '~/tabData.server'
import { getTabImages } from '~/getTabImages.server'
import { decodeString } from '~/utils/safeUrl'
// import { runGame } from '~/runGame.server'

export async function loader({ params }: LoaderFunctionArgs) {
  console.log('grid romdata romname loader')
  console.log('heres your params:')
  console.log(params)
  const romname = params.romname ? decodeString(params.romname).trim() : ''
  const system = params.system ? decodeString(params.system).trim() : ''
  console.log('in the grid.$romdata.$romname loader romname is ' + romname)
  // const romnameNoParens = romname.replace(/\(.*\)/g, '').trim()
  const thisSystemsTabs = await loadTabData(system)
  const { screenshots } = await getTabImages(romname, thisSystemsTabs, system)
  // const screenshots = tabContents.screenshots
  return { thisSystemsTabs, screenshots }
}

export default function MediaPanel() {
  const tabContents = useLoaderData<typeof loader>()
  // const data2 = useRouteLoaderData<typeof gridLoader>('routes/grid.$romdata')
  // console.log('data2 is:')
  // console.log(data2)
  // console.log('tabNames')
  // console.log(tabContents.tabNames)
  const { thisSystemsTabs } = tabContents
  const screenshots = tabContents.screenshots
  console.log('screenshots is:')
  console.log(screenshots)
  const tabs = thisSystemsTabs
  tabs.sort((a, b) => a.tabOrder - b.tabOrder)
  console.log('tabs is:')
  console.log(tabs)
  return (
    <Tabs>
      <TabList>
        {tabs.map((tab, index) => (
          <Tab key={index}>{tab.caption}</Tab>
        ))}
      </TabList>

      {tabs.map((tab, index) => (
        <TabPanel key={index}>
          {tab.caption === 'ScreenShots' ? <ScreenshotsTab screenshots={screenshots} /> : <h2>Good Game, son</h2>}
        </TabPanel>
      ))}
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