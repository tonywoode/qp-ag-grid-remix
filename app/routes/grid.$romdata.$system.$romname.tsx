import { Link, useFetcher, useLoaderData /*,useRouteLoaderData*/, useLocation } from '@remix-run/react'
// import { type loader as gridLoader } from 'grid.$romdata.tsx'
import { FaFilePdf, FaFileAlt } from 'react-icons/fa'
import type { LoaderFunctionArgs } from '@remix-run/node'
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs'
import { loadTabData } from '~/tabData.server'
// import { getTabImages } from '~/getTabImages.server'
import { decodeString } from '~/utils/safeUrl'
import { useEffect, useState } from 'react'
// import { runGame } from '~/runGame.server'
import parse, { domToReact, Element } from 'html-react-parser'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry' //we must import then use pdfjs's worker file to get it in the frontend build for pdfslick (or any pdf lib based on pdfjs) client will still warn 'setting up fake worker' but it will work
import SimplePDFViewer from '~/components/pdfViewer.client'
import pdfSlickCSS from '@pdfslick/react/dist/pdf_viewer.css' //TODO import this in pdf-specific route
import Modal from 'react-modal'
export function links() {
  return [{ rel: 'stylesheet', href: pdfSlickCSS }]
}
export async function loader({ params }: LoaderFunctionArgs) {
  console.log('grid romdata romname loader')
  console.log('heres your params:')
  console.log(params)
  const romname = params.romname ? decodeString(params.romname).trim() : ''
  const system = params.system ? decodeString(params.system).trim() : ''
  console.log('in the grid.$romdata.$romname loader romname is ' + romname)
  const thisSystemsTabs = await loadTabData(system)
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

const tabClassMap: { [key: string]: string } = {
  //PROBLEM: in QP, the extras tab for instance has been described as 'Thumnails' and originally we called that 'Screenshots' here, but they can be any mime type!
  //(original QP of course would only display screenshots out of the found extras files, doubtless my fault)
  Images: 'mediaItem',
  Thumbnail: 'mediaItem', //for now: what is the purpose of this distinction?
  MameHistory: 'mameDat',
  MameInfo: 'mameDat',
  MameCommand: 'mameDat',
  MameGameInit: 'mameDat',
  MameStory: 'mameDat',
  MameMessInfo: 'mameDat',
  MameSysinfo: 'mameDat' //note caps mistake in original qp
  //add more, should be Zod!
}

const openInDefaultBrowser = url => {
  window.open(url, '_blank', 'noopener,noreferrer')
}

const TextFileRenderer = ({ index, romname, base64Data }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    <div className="pl-3 bg-gray-800 text-white rounded-lg">
      <h1 className="text-2xl font-bold my-4 text-yellow-300" style={{ whiteSpace: 'pre-wrap' }}>
        {romname} Text File {index}
      </h1>
      <button onClick={toggleExpand} className="text-blue-500 underline">
        {isExpanded ? 'Collapse' : 'Expand'}
      </button>
      {isExpanded && (
        <pre key={index} className="whitespace-pre-wrap font-mono p-4 bg-gray-700 rounded-md">
          {atob(base64Data)} {/* note parse used in mameDats below, blows up here? */}
        </pre>
      )}
    </div>
  )
}

export default function MediaPanel() {
  console.log('pdfWorker needs using')
  console.log(pdfjsWorker) //we must USE it here to get it to load, it prints an empty object?!?
  const location = useLocation()
  const { thisSystemsTabs, romname, system } = useLoaderData<typeof loader>()
  const [selectedTabIndex, setSelectedTabIndex] = useState(0)
  const [tabContent, setTabContent] = useState({ tabClass: null, data: null })
  console.log('tab content')
  console.log(tabContent)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [lightboxContent, setLightboxContent] = useState(null)
  const { mameName, parentName } = location.state || {}
  const mameNames = { mameName, parentName }
  console.log('MameNames:', mameNames)
  const replaceLinks = node => {
    if (node.type === 'tag' && node.name === 'a') {
      const { href } = node.attribs
      return (
        <a
          href={href}
          onClick={e => {
            e.preventDefault()
            openInDefaultBrowser(href)
          }}
        >
          {domToReact(node.children)}
        </a>
      )
    }
  }
  useEffect(() => {
    const fetchTabContent = async () => {
      const selectedTab = thisSystemsTabs[selectedTabIndex]
      console.log(selectedTab)
      const tabClass = tabClassMap[selectedTab?.tabType]
      const searchType = selectedTab?.searchType
      const mameUseParentForSrch = selectedTab?.mameUseParentForSrch
      if (tabClass) {
        const response = await fetch('/tabContent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tabClass,
            searchType,
            romname,
            selectedTab,
            system,
            mameNames,
            mameUseParentForSrch
          })
        })
        const data = await response.json()
        setTabContent({ tabClass, data })
      } else {
        console.log('Tab type not handled:', selectedTab?.tabType)
        setTabContent({ tabClass: null, data: null })
      }
    }
    fetchTabContent()
  }, [selectedTabIndex, romname, system, thisSystemsTabs])

  useEffect(() => {
    Modal.setAppElement('#root') // Set the app element for react-modal (else it complains in console about aria)
  }, [])

  const openLightbox = content => {
    setLightboxContent(content)
    setIsLightboxOpen(true)
  }

  const closeLightbox = () => {
    setIsLightboxOpen(false)
    setLightboxContent(null)
  }

  function mediaTagRenderer(index, mediaItem, romname) {
    const base64String = mediaItem
    const [mimeInfo, base64Data] = base64String.split(',')
    const mimeType = mimeInfo.match(/:(.*?);/)[1]
    console.log('mimeType')
    console.log(mimeType)

    const handleVideoError = event => {
      console.error('Error playing video:', event)
    }

    const handleAudioError = event => {
      console.error('Error playing audio:', event)
    }

    const handlePDFError = event => {
      console.error('Error embedding PDF:', event)
    }

    if (mimeType === 'text/plain') {
      return (
        <div
          key={index}
          className="flex flex-col items-center justify-center p-4 cursor-pointer transition-transform transform hover:scale-110 flex-grow"
          onClick={() => openLightbox(<TextFileRenderer index={index} romname={romname} base64Data={base64Data} />)}
          style={{ flexBasis: '20%' }}
        >
          <FaFileAlt className="w-full h-full" />
        </div>
      )
    }

    if (mimeType.startsWith('video')) {
      return (
        <div key={index} className="flex-grow" style={{ flexBasis: '20%' }}>
          <video controls className="w-full h-auto" onError={handleVideoError}>
            <source src={mediaItem} type={mimeType} />
            Your browser does not support the video tag.
          </video>
        </div>
      )
    }

    if (mimeType.startsWith('audio')) {
      return (
        <div key={index} className="flex-grow" style={{ flexBasis: '20%' }}>
          <audio controls className="w-full h-auto" onError={handleAudioError}>
            <source src={mediaItem} type={mimeType} />
            Your browser does not support the audio tag.
          </audio>
        </div>
      )
    }

    //now pdfs
    if (mimeType === 'application/pdf') {
      try {
        // Remove the base64 prefix if it exists
        const base64String = mediaItem.split(',')[1] || mediaItem

        // Decode base64 string to ArrayBuffer
        const binaryString = atob(base64String.replace(/-/g, '+').replace(/_/g, '/'))
        const len = binaryString.length
        const bytes = new Uint8Array(len)
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        const arrayBuffer = bytes.buffer

        return (
          <div
            key={index}
            className="flex flex-col items-center justify-center p-4 cursor-pointer transition-transform transform hover:scale-110 flex-grow"
            onClick={() => openLightbox(<SimplePDFViewer pdfFilePath={arrayBuffer} />)}
            style={{ flexBasis: '20%' }}
          >
            <FaFilePdf className="w-full h-full" />
            {/* <embed src={mediaItem} type={mimeType} style={{ width: '100%', height: 'auto' }} onError={handlePDFError} /> */}
          </div>
        )
      } catch (error) {
        console.error('Failed to decode base64 string:', error)
        return <div key={index}>Failed to load PDF</div>
      }
    }

    if (mimeType.startsWith('image')) {
      return (
        <img
          key={index}
          src={mediaItem}
          alt={`Screenshot ${index}`}
          className="w-full h-auto flex-grow"
          style={{ flexBasis: '20%' }}
        />
      )
    }

    //TODO: do a mime lookup on the filename, if its renderable, try to render it in iframe, we exclude some types we don't want to render in the backend
    else {
      return (
        <iframe
          key={index}
          src={mediaItem}
          alt={`Random Mimetype ${index}`}
          className="w-full h-auto flex-grow"
          style={{ flexBasis: '20%' }}
        />
      )
    }
  }

  const tabContentRenderers = {
    mediaItem: data => (
      <div className="flex flex-wrap gap-4 justify-center">
        {data?.mediaItems?.length > 0 ? (
          data.mediaItems.map((mediaItem, index) => mediaTagRenderer(index, mediaItem, romname))
        ) : (
          <div>No media found</div>
        )}
      </div>
    ),
    mameDat: data =>
      data.mameDat && !data.mameDat.error ? (
        <div className="pl-3 bg-gray-800 text-white rounded-lg">
          <h1 className="text-2xl font-bold my-4 text-yellow-300" style={{ whiteSpace: 'pre-wrap' }}>
            {/* pre-wrap to preserve linespaces (some mame titles are in Japanese first with English below) */}
            {data.mameDat.title}
          </h1>
          {data.mameDat.gameHistoryLink && (
            <div className="my-4 underline text-blue-300 hover:text-blue-500">
              {parse(data.mameDat.gameHistoryLink, { replace: replaceLinks })}
              {/* replaceLinks to make them clickable, open in electron window */}
            </div>
          )}
          <div className="whitespace-pre-wrap font-mono p-4 bg-gray-700 rounded-md">{parse(data.mameDat.content)}</div>
        </div>
      ) : (
        <div>{data.mameDat.error}</div>
      )
  }

  const renderTabContent = () => {
    const renderFunction = tabContentRenderers[tabContent.tabClass]
    return renderFunction ? renderFunction(tabContent.data) : <h2>Tab content not available</h2>
  }

  return (
    <div>
      <Tabs selectedIndex={selectedTabIndex} onSelect={index => setSelectedTabIndex(index)}>
        <TabList className="sticky top-0 bg-white z-10">
          {thisSystemsTabs.map((tab, index) => (
            <Tab key={index}>{tab.caption}</Tab>
          ))}
        </TabList>
        <div className="overflow-auto h-full">
          {thisSystemsTabs.map((tab, index) => (
            <TabPanel key={index}>{renderTabContent()}</TabPanel>
          ))}
        </div>
      </Tabs>
      <Modal
        isOpen={isLightboxOpen}
        onRequestClose={closeLightbox}
        style={{
          content: {
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            marginRight: '-50%',
            transform: 'translate(-50%, -50%)',
            width: '80%',
            height: '80%'
          }
        }}
      >
        <div onClick={closeLightbox} style={{ width: '100%', height: '100%' }}>
          {lightboxContent}
        </div>
      </Modal>
    </div>
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
