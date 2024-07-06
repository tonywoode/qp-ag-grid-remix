import { Link, useFetcher, useLoaderData /*,useRouteLoaderData*/ } from '@remix-run/react'
// import { type loader as gridLoader } from 'grid.$romdata.tsx'
import type { LoaderFunctionArgs } from '@remix-run/node'
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs'
import { loadTabData } from '~/tabData.server'
// import { getTabImages } from '~/getTabImages.server'
import { decodeString } from '~/utils/safeUrl'
import { useEffect, useState } from 'react'
// import { runGame } from '~/runGame.server'
import parse from 'html-react-parser'

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
remember in qp there are a number of types....what are they? Here's from mediPanelConfigToJSON annotated with what they're acually called in orig qp frontend (so note this is undry its delcared there atm)
const searchTabTypeMapping: { [key: number]: string } = {
  0: 'Images', // 'Images/Slideshow'
  1: 'MameInfo', // 'Game info dat file'
  2: 'MameHistory', // 'Game history dat file'
  3: 'Thumbnail', // 'Thumbnails'
  4: 'System', // 'System'
  5: 'RomInfo', // 'Rom Info'
  // Original note: whilst it isn't terribly sensible to create these new types that all call the same imp but with different string config vars, the alternative is to rewrite a lot of the way media panel options work eg: linking to files not folders and a new form specifically for creating mame dat types that will let you choose the call
  6: 'MameCommand', // 'Mame Command dat file'
  7: 'MameGameInit', // 'Mame Game init file'
  8: 'MameMessInfo', // 'Mame Mess info file'
  9: 'MameStory', // 'Mame Story file'
  10: 'MameSysinfo' // 'Mame Mess sysInfo file')
}
  */

export default function MediaPanel() {
  const { thisSystemsTabs, romname, system } = useLoaderData<typeof loader>()
  const [selectedTabIndex, setSelectedTabIndex] = useState(0)
  const [tabContent, setTabContent] = useState({ tabType: null, data: null })

  useEffect(() => {
    const fetchTabContent = async () => {
      const selectedTab = thisSystemsTabs[selectedTabIndex]
      const tabTypeMap: { [key: string]: string } = {
        Images: 'screenshot',
        Thumbnail: 'screenshot',
        MameHistory: 'history'
        //add more!
      }
      const tabType = tabTypeMap[selectedTab?.tabType]

      if (tabType) {
        const response = await fetch('/tabContent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tabType, romname, selectedTab, system })
        })
        const data = await response.json()
        setTabContent({ tabType, data })
      } else {
        console.log('Tab type not handled:', selectedTab?.tabType)
        setTabContent({ tabType: null, data: null })
      }
    }
    fetchTabContent()
  }, [selectedTabIndex, romname, system, thisSystemsTabs])

  const tabContentRenderers = {
    screenshot: data => (
      <div>
        {data?.screenshots?.length > 0 ? (
          data.screenshots.map((screenshot, index) => (
            <img key={index} src={screenshot} alt={`Screenshot ${index}`} style={{ width: '100%', height: 'auto' }} />
          ))
        ) : (
          <div>Image not found</div>
        )}
      </div>
    ),
    history: data =>
      data.history && !data.history.error ? (
        <div>
          <h1 className="text-2xl font-bold my-4">{data.history.title}</h1>
          {parse(data.history.link)} {/* This will parse and render the <a> tag correctly */}
          <p className="whitespace-pre-wrap">{parse(data.history.content)}</p>{' '}
          {/* This will parse and render the content as HTML */}
        </div>
      ) : (
        <div>{data.history.error}</div>
      )
  }

  const renderTabContent = () => {
    const renderFunction = tabContentRenderers[tabContent.tabType]
    return renderFunction ? renderFunction(tabContent.data) : <h2>Tab content not available</h2>
  }

  return (
    <Tabs selectedIndex={selectedTabIndex} onSelect={index => setSelectedTabIndex(index)}>
      <TabList>
        {thisSystemsTabs.map((tab, index) => (
          <Tab key={index}>{tab.caption}</Tab>
        ))}
      </TabList>
      {thisSystemsTabs.map((tab, index) => (
        <TabPanel key={index}>{renderTabContent()}</TabPanel>
      ))}
    </Tabs>
  )
}

            // fetcher.submit(
            //   { romname, thisSystemsTabs, system },
            //   {
            //     action: `/screenshots`,
            //     method: 'post',
            //     encType: 'application/json'
            //   }
            // )
            // <h2> hello </h2>


/* {isRomSelected && <MediaPanel screenshots={base64Image ? [base64Image] : []}>{screenshotUrl}</MediaPanel>} */
/* <div>{screenshotUrl}</div> */

// export default function gameFile() {
// const params = useParams()
// const romname = decodeURI(params.romname)
// console.log(`/mypath/${romname}`)
// return <div>{romname}</div>
// }
