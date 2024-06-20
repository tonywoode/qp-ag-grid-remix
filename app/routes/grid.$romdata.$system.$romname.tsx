import { Link, useFetcher, useLoaderData /*,useRouteLoaderData*/ } from '@remix-run/react'
// import { type loader as gridLoader } from 'grid.$romdata.tsx'
import type { LoaderFunctionArgs } from '@remix-run/node'
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs'
import { ScreenshotsTab } from '~/components/ScreenshotsTab'
import { loadTabData } from '~/tabData.server'
// import { getTabImages } from '~/getTabImages.server'
import { decodeString } from '~/utils/safeUrl'
import { AiOutlineConsoleSql } from 'react-icons/ai'
import { useEffect, useState } from 'react'
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
  // const { screenshots } = await getTabImages(romname, thisSystemsTabs, system)
  // const screenshots = tabContents.screenshots
  return { thisSystemsTabs, romname, system }
}

export default function MediaPanel() {
  const fetcher = useFetcher()
  const tabContents = useLoaderData<typeof loader>()
  // const data2 = useRouteLoaderData<typeof gridLoader>('routes/grid.$romdata')
  // console.log('data2 is:')
  // console.log(data2)
  // console.log('tabNames')
  // console.log(tabContents.tabNames)
  const { thisSystemsTabs, romname, system } = tabContents
  // console.log('screenshots is:')
  // console.log(screenshots)
  const tabs = thisSystemsTabs
  tabs.sort((a, b) => a.tabOrder - b.tabOrder)
  console.log('tabs is:')
  console.log(tabs)

  /*
here's the current values of tabs.caption in the data:
[
  'ScreenShots',    'Titles',
  'Box',            'Flyers',
  'System Info',    'Extras',
  'Manuals',        'Game History',
  'Samples',        'Marquees',
  'Game Info',      'Mame Command dat',
  'Mame Game Init', 'Mame Mess Info',
  'Mame Story Dat', 'Mame Mess SysInfo',
  'ArtPreview',     'Cabinets',
  'Control Panels', 'Game Over',
  'How To',         'Logo',
  'pcb',            'Scores',
  'Select',         'Versus',
  'Gamepad',        'Cart',
  'Background',     'Banner',
  'Box3D',          'MAME Info',
  'Advert',         'Box Back',
  'CD'
]
remember in qp there are a number of types....what are they?
well

Items.Strings = (
      'Images/Slideshow'
      'Game info dat file'
      'Game history dat file'
      'Thumbnails'
      'System'
      'Rom Info'
      'Mame Command dat file'
      'Mame Game init file'
      'Mame Mess info file'
      'Mame Story file'
      'Mame Mess sysInfo file')


*/
  const [data, setData] = useState(null)

  useEffect(() => {
    if (tabs.some(tab => tab.caption === 'ScreenShots')) {
      fetch('/screenshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ romname, thisSystemsTabs, system })
      })
        .then(response => response.json())
        .then(data => setData(data))
    }
  }, [tabs, romname, thisSystemsTabs, system])

  return (
    <Tabs>
      <TabList>
        {tabs.map((tab, index) => (
          <Tab key={index}>{tab.caption}</Tab>
        ))}
      </TabList>

      {tabs.map((tab, index) => (
        <TabPanel key={index}>
          {tab.caption === 'ScreenShots' ? (
            <div>
              {data &&
                data.screenshots &&
                data.screenshots.map((screenshot, index) => <img key={index} src={`${screenshot}`} alt="Screenshot" />)}
            </div>
          ) : (
            // fetcher.submit(
            //   { romname, thisSystemsTabs, system },
            //   {
            //     action: `/screenshots`,
            //     method: 'post',
            //     encType: 'application/json'
            //   }
            // )
            // <h2> hello </h2>
            <h2>Good Game, son</h2>
          )}
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
