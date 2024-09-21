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
export function links() {
  return [{ rel: 'stylesheet', href: pdfSlickCSS }]
}
import Modal from 'react-modal'
// import ImageNavigation from '~/Components/ImageNavigation'
import { VscChevronLeft, VscChevronRight, VscZoomIn, VscZoomOut } from 'react-icons/vsc'

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

const calculateImageDimensions = (src, callback) => {
  const img = new Image()
  img.src = src
  img.onload = () => {
    const screenWidth = window.innerWidth
    const screenHeight = window.innerHeight
    const imgWidth = img.width
    const imgHeight = img.height
    const widthScale = (screenWidth * 0.8) / imgWidth
    const heightScale = (screenHeight * 0.8) / imgHeight
    const scale = Math.min(widthScale, heightScale)
    callback({
      width: imgWidth * scale,
      height: imgHeight * scale
    })
  }
}

const TextFileRenderer = ({ index, romname, base64Data }) => {
  return (
    <div className="pl-3 bg-gray-800 text-white rounded-lg">
      <h1 className="text-2xl font-bold my-4 text-yellow-300" style={{ whiteSpace: 'pre-wrap' }}>
        {romname} Text File {index}
      </h1>
      <pre key={index} className="whitespace-pre-wrap font-mono p-4 bg-gray-700 rounded-md">
        {atob(base64Data)} {/* note parse used in mameDats below, blows up here? */}
      </pre>
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
  const [lightboxDimensions, setLightboxDimensions] = useState({ width: 'auto', height: 'auto' })
  const [contentType, setContentType] = useState('') //for the lightbox pdf issue
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

  const openLightbox = (content, type, src) => {
    if (type.startsWith('image')) {
      calculateImageDimensions(src, dimensions => {
        setLightboxDimensions(dimensions)
        setLightboxContent(content)
        setIsLightboxOpen(true)
      })
    } else if (type === 'text/plain') {
      setLightboxDimensions({ width: 'auto', height: 'auto' })
      setLightboxContent(content)
      setContentType(type) //this is needed, triggers css on modal to change! why are we only setting it in this case?
      setIsLightboxOpen(true)
    } else if (type === 'application/pdf') {
      setLightboxDimensions({ width: '50%', height: '100%' })
      setLightboxContent(content)
      setIsLightboxOpen(true)
    } else {
      setLightboxDimensions({ width: '80%', height: '80%' })
      setLightboxContent(content)
      setIsLightboxOpen(true)
    }
  }

  const closeLightbox = event => {
    // Check if the click target is a clickable element, don't clobber e.g.: pdf pagination
    if (event.target.closest('button, a, input, select, textarea')) {
      return
    }
    setIsLightboxOpen(false)
    setLightboxContent(null)
  }

  const ImageNavigation = ({ images, currentIndex, onClose, imageDimensions }) => {
    const [index, setIndex] = useState(currentIndex)
    const [scale, setScale] = useState(1)
    const [loading, setLoading] = useState(true)
    const [thisImageDimensions, setThisImageDimensions] = useState({ width: 0, height: 0 })

    useEffect(() => {
      setLoading(true)
      calculateImageDimensions(images[index], dimensions => {
        setScale(1)
        setLightboxDimensions(dimensions)
        setThisImageDimensions(dimensions)
        setLoading(false)
      })
    }, [index, images])

    const zoomIn = () => setScale(prev => Math.min(prev + 0.25, 5))
    const zoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.25))
    const nextImage = () => setIndex(prev => Math.min(prev + 1, images.length - 1))
    const prevImage = () => setIndex(prev => Math.max(prev - 1, 0))

    return (
      <div className="fixed top-0 left-0 flex items-center justify-center bg-black bg-opacity-75 z-50">
        <div className="relative" style={{ width: 'auto', height: 'auto' }}>
          {!loading && (
            <img
              src={images[index]}
              alt={`${index + 1}`}
              style={{
                width: `${thisImageDimensions.width * scale}px`,
                height: `${thisImageDimensions.height * scale}px`,
                objectFit: 'contain',
                transition: 'opacity 0.3s ease-in-out'
              }}
            />
          )}
          <div className="absolute bottom-0 w-full flex justify-center space-x-2 p-2 bg-white bg-opacity-75">
            <button onClick={prevImage} disabled={index === 0} className="p-2">
              <VscChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={zoomOut} disabled={scale <= 0.25} className="p-2">
              <VscZoomOut className="h-5 w-5" />
            </button>
            <button onClick={zoomIn} disabled={scale >= 5} className="p-2">
              <VscZoomIn className="h-5 w-5" />
            </button>
            <button onClick={nextImage} disabled={index === images.length - 1} className="p-2">
              <VscChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    )
  }
  function mediaTagRenderer(index, mediaItem, romname, mediaItems) {
    const base64String = mediaItem
    const [mimeInfo, base64Data] = base64String.split(',')
    const mimeType = mimeInfo.match(/:(.*?);/)[1]
    console.log('mimeType')
    console.log(mimeType)

    const handleVideoError = event => console.error('Error playing video:', event)
    const handleAudioError = event => console.error('Error playing audio:', event)
    const handlePDFError = event => console.error('Error embedding PDF:', event)

    if (mimeType === 'text/plain') {
      return (
        <div
          key={index}
          className="flex flex-col items-center justify-center p-4 cursor-pointer transition-transform transform hover:scale-110 flex-grow"
          onClick={() =>
            openLightbox(
              <TextFileRenderer index={index} romname={romname} base64Data={base64Data} />,
              mimeType,
              base64Data
            )
          }
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
            onClick={() => openLightbox(<SimplePDFViewer pdfFilePath={arrayBuffer} />, mimeType)}
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
          className="w-full h-auto flex-grow cursor-pointer"
          style={{ flexBasis: '20%' }}
          onClick={() =>
            openLightbox(
              <ImageNavigation
                images={mediaItems}
                currentIndex={index}
                onClose={() => setIsLightboxOpen(false)}
                imageDimensions={lightboxDimensions}
              />,
              'image',
              mediaItem
            )
          }
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
          data.mediaItems.map((mediaItem, index) => mediaTagRenderer(index, mediaItem, romname, data.mediaItems))
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
            width: lightboxDimensions.width,
            height: lightboxDimensions.height,
            maxWidth: '80%',
            maxHeight: '80%',
            overflow: 'auto',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            transition: 'width 0.3s ease-in-out, height 0.3s ease-in-out',
            ...(contentType === 'text/plain' && {
              alignItems: 'flex-start'
            })
          }
        }}
      >
        {lightboxContent}
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