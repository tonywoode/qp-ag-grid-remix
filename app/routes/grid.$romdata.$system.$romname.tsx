import { Link, useFetcher, useLoaderData /*,useRouteLoaderData*/, useLocation } from '@remix-run/react'
// import { type loader as gridLoader } from 'grid.$romdata.tsx'
import { FaFilePdf, FaFileAlt } from 'react-icons/fa'
import type { LoaderFunctionArgs } from '@remix-run/node'
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs'
import { loadTabData } from '~/tabData.server'
// import { getTabImages } from '~/getTabImages.server'
import { decodeString } from '~/utils/safeUrl'
import { useEffect, useState, useRef, useMemo } from 'react'
// import { runGame } from '~/runGame.server'
import parse, { domToReact, Element } from 'html-react-parser'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry' //we must import then use pdfjs's worker file to get it in the frontend build for pdfslick (or any pdf lib based on pdfjs) client will still warn 'setting up fake worker' but it will work
import SimplePDFViewer from '~/components/pdfViewer.client'
import Modal from 'react-modal'
import pdfSlickCSS from '@pdfslick/react/dist/pdf_viewer.css'
import { VscChevronLeft, VscChevronRight, VscSearch } from 'react-icons/vsc'
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

export default function MediaPanel() {
  const location = useLocation()
  const { thisSystemsTabs, romname, system } = useLoaderData<typeof loader>()
  const [selectedTabIndex, setSelectedTabIndex] = useState(0)
  const [tabContent, setTabContent] = useState({ tabClass: null, data: null })
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
        console.error('Tab type not handled:', selectedTab?.tabType)
        setTabContent({ tabClass: null, data: null })
      }
    }
    fetchTabContent()
  }, [selectedTabIndex, romname, system, thisSystemsTabs])

  useEffect(() => {
    Modal.setAppElement('#root') // Set the app element for react-modal (else it complains in console about aria)
  }, [])

  const closeLightbox = event => {
    if (event.target.closest('button, a, input, select, textarea')) {
      return
    }
    setIsLightboxOpen(false)
    setLightboxContent(null)
  }

  function mediaTagRenderer({ currentIndex, romname, mediaItems }) {
    const mediaItem = mediaItems[currentIndex]
    const base64String = mediaItem
    const [mimeInfo, base64Data] = base64String?.split(',')
    const mimeType = mimeInfo.match(/:(.*?);/)[1]
    console.log('mimeType')
    console.log(mimeType)
    const handleVideoError = event => console.error('Error playing video:', event)
    const handleAudioError = event => console.error('Error playing audio:', event)

    if (mimeType.startsWith('text')) {
      return (
        <div
          key={currentIndex}
          className="flex flex-col items-center justify-center p-4 cursor-pointer transition-transform transform hover:scale-110 flex-grow"
          onClick={() => {
            setLightboxContent({ currentIndex, romname, mediaItems })
            setIsLightboxOpen(true)
          }}
          style={{ flexBasis: '20%' }}
        >
          <FaFileAlt className="w-full h-full" />
        </div>
      )
    }

    //TODO: convert/handle
    if (mimeType.startsWith('video')) {
      return (
        <div key={currentIndex} className="flex-grow" style={{ flexBasis: '20%' }}>
          <video controls className="w-full h-auto" onError={handleVideoError}>
            <source src={mediaItem} type={mimeType} />
            Your browser does not support the video tag.
          </video>
        </div>
      )
    }

    //TODO: convert/handle
    if (mimeType.startsWith('audio')) {
      return (
        <div key={currentIndex} className="flex-grow" style={{ flexBasis: '20%' }}>
          <audio controls className="w-full h-auto" onError={handleAudioError}>
            <source src={mediaItem} type={mimeType} />
            Your browser does not support the audio tag.
          </audio>
        </div>
      )
    }

    if (mimeType === 'application/pdf') {
      return (
        <div
          key={currentIndex}
          className="flex flex-col items-center justify-center p-4 cursor-pointer transition-transform transform hover:scale-110 flex-grow"
          onClick={() => {
            setLightboxContent({ mediaItems, currentIndex })
            setIsLightboxOpen(true)
          }}
          style={{ flexBasis: '20%' }}
        >
          <FaFilePdf className="w-full h-full" />
        </div>
      )
    }

    if (mimeType.startsWith('image')) {
      return (
        <img
          key={currentIndex}
          src={mediaItem}
          alt={`Screenshot ${currentIndex}`}
          className="w-full h-auto flex-grow cursor-pointer"
          style={{ flexBasis: '20%' }}
          onClick={() => {
            setLightboxContent({ mediaItems, currentIndex })
            setIsLightboxOpen(true)
          }}
        />
      )
    }

    //TODO: do a mime lookup on the filename, if its renderable, try to render it in iframe, we exclude some types we don't want to render in the backend
    //TODO: lightbox? mediaItem would now hit image handling.....
    //no mimetype handling potentially considered harmful, off for now!
    // else {
    //   return (
    //     <iframe
    //       key={currentIndex}
    //       src={mediaItem}
    //       alt={`Random Mimetype ${currentIndex}`}
    //       className="w-full h-auto flex-grow"
    //       style={{ flexBasis: '20%' }}
    //     />
    //   )
    // }
  }

  const tabContentRenderers = {
    mediaItem: data => (
      <div className="flex flex-wrap gap-4 justify-center">
        {data?.mediaItems?.length > 0 ? (
          data.mediaItems.map((_, currentIndex, mediaItems) => mediaTagRenderer({ currentIndex, romname, mediaItems }))
        ) : (
          <div>No media found</div>
        )}
      </div>
    ),
    mameDat: data =>
      data.mameDat && !data.mameDat.error ? (
        <div className="p-3 bg-gray-800 text-white rounded-lg">
          <h1 className="text-2xl font-bold my-4 text-yellow-300 whitespace-pre-wrap">
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

  return (
    <div>
      <Tabs selectedIndex={selectedTabIndex} onSelect={index => setSelectedTabIndex(index)}>
        <TabList className="sticky top-0 bg-white z-2">
          {thisSystemsTabs.map((tab, index) => (
            <Tab key={index}>{tab.caption}</Tab>
          ))}
        </TabList>
        <div className="overflow-auto h-full">
          {thisSystemsTabs.map((tab, index) => {
            const selectedTab = thisSystemsTabs[selectedTabIndex]
            return (
              <TabPanel key={index}>
                {tabContentRenderers[tabContent.tabClass]?.(tabContent.data) ?? <h2>Tab content not available</h2>}
              </TabPanel>
            )
          })}
        </div>
      </Tabs>
      {lightboxContent && (
        <MediaNavigation {...lightboxContent} isLightboxOpen={isLightboxOpen} closeLightbox={closeLightbox} />
      )}
    </div>
  )
}

type MediaContent = {
  romname: string
  mediaItems: string[]
  currentIndex: number
}

function MediaNavigation({
  isLightboxOpen,
  closeLightbox,
  ...mediaContent
}: MediaContent & { isLightboxOpen: boolean; closeLightbox: () => void }) {
  const { romname, mediaItems, currentIndex } = mediaContent
  const [index, setIndex] = useState(currentIndex)
  const [mimeInfo, base64Data] = mediaItems[index]?.split(',')
  const mimeType = mimeInfo.match(/:(.*?);/)[1]
  const pdfFilePath = useMemo(() => {
    if (mimeType === 'application/pdf') {
      ;(() => pdfjsWorker)() // we must USE it here to get pdfs to load (common problem with pdfjs libs!)
      try {
        const base64String = mediaItems[index].split(',')[1] || mediaItems[index]
        const binaryString = atob(base64String.replace(/-/g, '+').replace(/_/g, '/'))
        const bytes = Uint8Array.from(binaryString, char => char.charCodeAt(0))
        return bytes.buffer
      } catch (error) {
        console.error('Failed to decode base64 string:', error)
        return null
      }
    }
    return null
  }, [index, mediaItems, mimeType])

  const [thisImageDimensions, setThisImageDimensions] = useState({ width: 'auto', height: 'auto' }) //don't worry about starting dimensions
  const [zoomLevel, setZoomLevel] = useState(1)
  const [isSliderActive, setIsSliderActive] = useState(false)
  const initialTouchDistanceRef = useRef(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 })
  const [originalDimensions, setOriginalDimensions] = useState({ width: 0, height: 0 })
  const scrollContainerRef = useRef(null)
  const lastTouchPositionRef = useRef({ x: 0, y: 0 })

  //TODO: log mode!
  useEffect(() => {
    console.log('This Image Dimensions:', thisImageDimensions)
  }, [thisImageDimensions])

  const calculateImageDimensions = src => {
    return new Promise((resolve, reject) => {
      if (!src) return reject(new Error('Image source is required'))
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
        resolve({
          width: imgWidth * scale,
          height: imgHeight * scale,
          scale
        })
      }
      img.onerror = () => reject(new Error('Failed to load image'))
    })
  }

  const fetchDimensions = async () => {
    const dimensions = await calculateImageDimensions(mediaItems[index])
    setOriginalDimensions({ width: dimensions.width, height: dimensions.height })
    const newDimensions = {
      width: dimensions.width * zoomLevel,
      height: dimensions.height * zoomLevel
    }
    setThisImageDimensions(newDimensions)
  }

  useEffect(() => {
    if (mimeType.startsWith('image')) fetchDimensions() //handle async
    if (mimeType.startsWith('text')) {
      setThisImageDimensions({ width: 'auto', height: 'auto' })
    }
    if (mimeType === 'application/pdf') {
      setThisImageDimensions({ width: '50%', height: '100%' })
    }
  }, [index, mediaItems, zoomLevel])

  const handleMouseDown = e => {
    if (!isSliderActive) {
      setIsDragging(true)
      setDragStart({ x: e.clientX, y: e.clientY })
    }
  }
  const handleDragStart = e => e.preventDefault()

  const handleMouseMove = e => {
    if (isDragging && !isSliderActive) {
      const scrollContainer = scrollContainerRef.current
      if (scrollContainer) {
        scrollContainer.scrollLeft -= e.movementX
        scrollContainer.scrollTop -= e.movementY
      }
    }
  }

  const handleMouseUp = () => {
    if (!isSliderActive) {
      setIsDragging(false)
    }
  }

  const handleZoomChange = event => {
    const sliderValue = Math.max(1, Math.min(parseFloat(event.target.value), 5)) // Constrain between 1 and 5
    setZoomLevel(sliderValue)
    const newDimensions = {
      width: originalDimensions.width * sliderValue,
      height: originalDimensions.height * sliderValue
    }
    setThisImageDimensions(newDimensions)
  }

  //here we can't use the prev fn form of state update, jaggy....
  const updateImageDimensions = zoom => {
    const newDimensions = {
      width: thisImageDimensions.width * zoom,
      height: thisImageDimensions.height * zoom
    }
    setThisImageDimensions(newDimensions)
  }

  const zoomIn = () => {
    setZoomLevel(prev => {
      const newZoomLevel = Math.min(prev + 0.25, 5) // Allow zooming up to 500%
      updateImageDimensions(newZoomLevel / prev)
      return newZoomLevel
    })
  }

  const zoomOut = () => {
    setZoomLevel(prev => {
      const newZoomLevel = Math.max(prev - 0.25, 0.25) // Allow zooming down to 25
      updateImageDimensions(newZoomLevel / prev)
      return newZoomLevel
    })
  }
  const prevImage = () => {
    setIndex(prev => {
      const newIndex = prev === 0 ? mediaItems.length - 1 : prev - 1
      setImagePosition({ x: 0, y: 0 }) // Reset drag position
      return newIndex
    })
  }

  const nextImage = () => {
    setIndex(prev => {
      const newIndex = prev === mediaItems.length - 1 ? 0 : prev + 1
      setImagePosition({ x: 0, y: 0 }) // Reset drag position
      return newIndex
    })
  }

  const handleTouchStart = e => {
    if (e.touches.length === 2) {
      // Store initial touch positions and distance
      const [touch1, touch2] = e.touches
      initialTouchDistanceRef.current = Math.hypot(touch2.pageX - touch1.pageX, touch2.pageY - touch1.pageY)
    }
  }

  const handleWheel = e => {
    if (e.deltaY < 0) {
      zoomIn()
    } else {
      zoomOut()
    }
  }

  const handleTouchMove = e => {
    if (isDragging && !isSliderActive) {
      const scrollContainer = scrollContainerRef.current
      if (scrollContainer) {
        const touch = e.touches[0]
        scrollContainer.scrollLeft -= touch.clientX - lastTouchPositionRef.current.x
        scrollContainer.scrollTop -= touch.clientY - lastTouchPositionRef.current.y
        lastTouchPositionRef.current = { x: touch.clientX, y: touch.clientY }
      }
    }
  }
  useEffect(() => {
    const handleKeyDown = event => {
      if (event.key === 'ArrowLeft') {
        prevImage()
      } else if (event.key === 'ArrowRight') {
        nextImage()
      } else if (event.key === 'ArrowUp') {
        zoomIn()
      } else if (event.key === 'ArrowDown') {
        zoomOut()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [mimeType, nextImage, prevImage, zoomIn, zoomOut])

  const renderTextContent = () => (
    <div className="p-3 bg-gray-800 text-white rounded-lg">
      <h1 className="text-2xl font-bold my-4 text-yellow-300 whitespace-pre-wrap">
        {romname} Text File {index}
      </h1>
      <pre key={index} className="whitespace-pre-wrap font-mono p-4 bg-gray-700 rounded-md">
        {atob(base64Data)} {/* note parse used in mameDats below, blows up here? */}
      </pre>
    </div>
  )

  const renderPDFContent = () => (
    <SimplePDFViewer pdfFilePath={pdfFilePath} /> //TODO: if we rid ourselves of pdfFilePath(1) here (which we should do) the pdf dimensions are wrong if a pdf is directly clicked-on?
  )

  const renderImageContent = () => (
    <div
      ref={scrollContainerRef}
      className="fixed inset-0 overflow-auto touch-none"
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <img
        src={mediaItems[index]}
        alt={`${index + 1}`}
        onDragStart={handleDragStart}
        className="object-contain rounded-lg"
        style={{
          maxWidth: 'none', // Allow image to exceed container width
          maxHeight: 'none', // Allow image to exceed container height
          borderRadius: '1.5rem',
          cursor: isDragging ? 'grabbing' : 'grab',
          width: `${thisImageDimensions.width}px`,
          height: `${thisImageDimensions.height}px`
        }}
      />
      <div className="fixed bottom-0 left-0 w-full flex justify-center items-center space-x-2 p-4 bg-white bg-opacity-75 select-none">
        <button onClick={prevImage} className="p-2">
          <VscChevronLeft className="h-5 w-5" />
        </button>
        <div
          className="relative flex items-center justify-center"
          onMouseEnter={() => setIsSliderActive(true)}
          onMouseLeave={() => setIsSliderActive(false)}
        >
          <VscSearch className={`h-5 w-5 ${isSliderActive ? 'invisible' : 'block'}`} />
          {isSliderActive && (
            <div className="absolute bottom-3/4 mb-32 flex flex-col items-center">
              <input
                type="range"
                min="1"
                max="2"
                step="0.05"
                value={zoomLevel}
                onChange={handleZoomChange}
                className="w-80 h-12 appearance-none rounded-full cursor-pointer transform -rotate-90 outline-none backdrop-blur"
                style={{
                  background: 'linear-gradient(to left, rgba(255,255,255, 0), rgba(255,255,255, 0.65))'
                }}
                onMouseDown={() => setIsSliderActive(true)}
                onMouseUp={() => setIsSliderActive(false)}
              />
              <style jsx>{`
                input[type='range']::-webkit-slider-thumb {
                  width: 1rem;
                  height: 1rem;
                  background: rgba(255, 255, 255, 0.75);
                  border: 0.1rem solid rgba(1, 1, 1, 1);
                  border-radius: 100%;
                  opacity: 0.35;
                  cursor: pointer;
                  webkitappearance: none;
                  appearance: none;
                }
              `}</style>
            </div>
          )}
        </div>
        <button onClick={nextImage} className="p-2">
          <VscChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  )

  const renderContent = () => {
    if (mimeType.startsWith('text')) {
      return renderTextContent()
    } else if (mimeType === 'application/pdf') {
      return renderPDFContent()
    } else if (mimeType.startsWith('image')) {
      return renderImageContent()
    } else {
      return <div>Unsupported MIME type</div>
    }
  }

  return (
    <Modal
      isOpen={isLightboxOpen}
      onRequestClose={closeLightbox}
      style={{
        overlay: { zIndex: 3 },
        content: {
          top: '50%',
          left: '50%',
          right: 'auto',
          bottom: 'auto',
          transform: 'translate(-50%, -50%)',
          width: thisImageDimensions.width,
          height: thisImageDimensions.height,
          maxWidth: mimeType.startsWith('text') ? '80%' : '100%',
          maxHeight: mimeType.startsWith('text') ? '80%' : '100%',
          overflow: mimeType.startsWith('text') ? 'auto' : 'hidden',
          display: 'flex',
          justifyContent: 'center',
          alignItems: mimeType.startsWith('text') ? 'flex-start' : 'center',
          border: 'none'
        }
      }}
    >
      {renderContent()}
    </Modal>
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