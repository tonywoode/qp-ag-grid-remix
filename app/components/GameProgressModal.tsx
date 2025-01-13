import Modal from 'react-modal'
import { useEffect, useRef, useState } from 'react'
import { useFetcher } from '@remix-run/react'
import { IoGameControllerOutline } from 'react-icons/io5'
import { DiJsBadge } from 'react-icons/di'
import { Si7Zip } from 'react-icons/si'

type ProgressModalProps = {
  isOpen: boolean
  onClose: () => void
  gameDetails: {
    name: string
    path: string
    status: string
    logs: string[]
  }
  eventData: string | null //SSE data comes as string or null if no event
}

const MINIMIZED_HEIGHT_REM = 20

type Position = {
  x: string
  y: string
  /**
   * centered: uses percentage positioning with transform for centered modal
   * pixels: uses exact pixel coordinates, needed during/after drag
   *
   * why two types? we need percentage+transform for initial centered modal,
   * but must switch to pixels when dragging starts because:
   * 1. transform interferes with drag position calculations
   * 2. percentage position would make the modal jump when dragging starts
   * 3. exact pixel positions ensure smooth drag movement
   */
  type: 'centered' | 'pixels'
}

const DEFAULT_POSITIONS = {
  minimized: { x: '1vw', y: `calc(99vh - ${MINIMIZED_HEIGHT_REM}rem)`, type: 'pixels' } as Position,
  maximized: { x: '50%', y: '50%', type: 'centered' } as Position
}

export function GameProgressModal({ isOpen, onClose, gameDetails, eventData }: ProgressModalProps) {
  const fetcher = useFetcher()
  const containerRef = useRef<HTMLDivElement>(null)
  const [logs, setLogs] = useState<object[]>(gameDetails.logs)
  const [status, setStatus] = useState<string>(gameDetails.status)
  const [isMinimized, setIsMinimized] = useState(false)
  const [minimizedPosition, setMinimizedPosition] = useState<Position>(DEFAULT_POSITIONS.minimized)
  const [maximizedPosition, setMaximizedPosition] = useState<Position>(DEFAULT_POSITIONS.maximized)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [zipStatus, setZipStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const hasError = logs.some(log => log.data.toLowerCase().includes('error'))
  useEffect(() => Modal.setAppElement('#root'), []) //set the app element for react-modal (else it complains in console about aria)

  useEffect(() => {
    console.log('the eventData useEffect ran')
    if (eventData) {
      const eventContent = JSON.parse(eventData) as { type: string; data: string }
      console.log('runGame event:', eventContent)
      // setLogs(prevLogs => [...prevLogs, `[${eventContent.type}] ${eventContent.data}`])
      setLogs(prevLogs => [...prevLogs, eventContent])
      if (eventContent.type === 'status') {
        console.log('Setting status to:', eventContent.data)
        setStatus(eventContent.data)
        if (eventContent.data === 'closed') {
          setIsMinimized(false)
        }
        if (eventContent.data === 'zip-success') setZipStatus('success')
        else if (eventContent.data.startsWith('zip-error')) setZipStatus('error')
        // else if (eventContent.data === 'zip-error') setZipStatus('error')
      }
      if (eventContent.type === 'onlyOneEmu') alert(eventContent.data)
    }
  }, [eventData])

  //terminal like scroll to latest message
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [logs.length])

  //stop printing the last message from the previous run as the first message in the next
  useEffect(() => {
    setLogs([])
    setStatus('') // Reset status when modal opens
    setZipStatus('pending')
  }, [isOpen])

  function resetAllPositions() {
    setIsMinimized(false)
    setMinimizedPosition(DEFAULT_POSITIONS.minimized)
    setMaximizedPosition(DEFAULT_POSITIONS.maximized)
  }

  function updatePosition(mode: 'minimized' | 'maximized', pos: Position) {
    //ensure we never accidentally mix position types - centered is only valid for initial maximized state
    if (mode === 'minimized' && pos.type === 'centered') console.warn('minimized position should always use pixels')
    if (mode === 'minimized') setMinimizedPosition(pos)
    else setMaximizedPosition(pos)
  }

  const handleClose = () => {
    if (status === 'running') {
      setIsMinimized(true)
      //scroll to bottom when minimizing, timeout to ensure we catch any logs added - necessary?
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight
        }
      }, 0)
    } else {
      resetAllPositions()
      onClose()
    }
  }

  const handleConfirmClose = () => {
    fetcher.submit({ clearProcess: true }, { action: '/runGame', method: 'post', encType: 'application/json' })
    resetAllPositions()
    onClose()
  }

  //only way to lose the drag and drop 'drag-image': pre-load a tranparent nothing
  const blankDragImage = new Image()
  blankDragImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs='

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={handleClose}
      shouldCloseOnOverlayClick={true}
      contentLabel="Game Progress"
      className={`inline-flex ${isMinimized ? 'fixed bottom-4 right-4 w-1/4 h-1/3' : 'w-1/2 h-1/2'}`}
      style={{
        overlay: {
          backgroundColor: !isMinimized ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
          pointerEvents: !isMinimized ? 'auto' : 'none'
        },
        content: {
          position: 'fixed',
          left: isMinimized ? minimizedPosition.x : maximizedPosition.x,
          top: isMinimized ? minimizedPosition.y : maximizedPosition.y,
          transform: isMinimized || maximizedPosition.type === 'pixels' ? 'none' : 'translate(-50%, -50%)',
          pointerEvents: 'auto',
          zIndex: 1001,
          maxHeight: isMinimized ? `${MINIMIZED_HEIGHT_REM}rem` : '80vh',
          overflow: 'auto',
          padding: 0 // Remove default Modal padding - necessary?
        }
      }}
      overlayClassName={`fixed w-full h-screen top-0 left-0 z-[1000] ${
        isMinimized ? '' : 'backdrop-blur-[1.2px]'
      } flex justify-center items-center`}
      shouldCloseOnEsc={false} //because esc exits emulators like retroarch, hold it down for 2ms too long and....
    >
      <div className="relative bg-white rounded w-full h-full mx-auto flex flex-col px-4">
        {/* Header with summaries */}
        <div
          //Added negative margin (?!?) and padding to header to maintain full width while keeping content aligned
          className="flex flex-col p-3 border-b border-gray-200 cursor-move select-none bg-gray-50 -mx-4 px-4"
          draggable="true"
          onMouseDown={e => {
            const rect = e.currentTarget.getBoundingClientRect()
            setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top })
          }}
          onDragStart={e => {
            const rect = e.currentTarget.parentElement?.getBoundingClientRect()
            if (!rect) return
            //convert centered position to pixels on first drag
            if (maximizedPosition.type === 'centered') {
              setMaximizedPosition({ x: `${rect.left}px`, y: `${rect.top}px`, type: 'pixels' })
            }
            e.dataTransfer.setData('text', '') //needed for firefox
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setDragImage(blankDragImage, 0, 0)
          }}
          onDrag={e => {
            if (e.clientX === 0 && e.clientY === 0) return
            const newPosition: Position = {
              x: `${e.clientX - dragOffset.x}px`,
              y: `${e.clientY - dragOffset.y}px`,
              type: 'pixels'
            }
            updatePosition(isMinimized ? 'minimized' : 'maximized', newPosition)
          }}
        >
          <span className="font-medium text-gray-800">{gameDetails.name}</span>
          <div className="flex items-center space-x-2 mt-2">
            <div className="flex items-center">
              <span className="mr-2 text-sm text-gray-600">Unzip:</span>
              {zipStatus === 'success' ? (
                <span className="text-green-500">✓</span>
              ) : zipStatus === 'error' ? (
                <span className="text-red-500">✗</span>
              ) : (
                <span className="animate-spin">○</span>
              )}
            </div>
            <div className="flex items-center">
              <span className="mr-2 text-sm text-gray-600">Launch:</span>
              {status === 'running' ? (
                <span className="text-green-500">✓</span>
              ) : (
                <span className="text-gray-400">○</span>
              )}
            </div>
          </div>
        </div>
        {/* Console Output */}
        <div
          ref={containerRef}
          className="flex-grow overflow-auto bg-black text-white p-4 rounded my-4 whitespace-pre-wrap select-text"
        >
          {logs.map(({ type, data }, i) => (
            <div key={i}>
              {
                //an event can have multiple log lines, we only want to colour the error lines in red (works well for retroarch)
                data.split('\n').map((data, j) => (
                  <div
                    key={j}
                    className={`${data.toLowerCase().includes('error') ? 'text-red-500' : 'text-green-500'}`}
                  >
                    {data !== '' ? (
                      <div className="flex items-center">
                        {type.startsWith('Emu') && <IoGameControllerOutline className="mr-2 text-2xl" />}
                        {(type.startsWith('QPBackend') ||
                          type.startsWith('status') ||
                          type.startsWith('onlyOneEmu')) && <DiJsBadge className="mr-2 text-2xl" />}
                        {type.startsWith('zip') && (
                          <Si7Zip
                            className={`mr-2 text-2xl ${
                              zipStatus === 'success'
                                ? 'text-green-500'
                                : zipStatus === 'error'
                                  ? 'text-red-500'
                                  : 'animate-spin'
                            }`}
                          />
                        )}
                        {data}
                      </div>
                    ) : (
                      ''
                    )}
                  </div>
                ))
              }
            </div>
          ))}
        </div>
        <div className="flex justify-end pb-3">
          <button
            className={`px-4 py-1 ${isMinimized ? 'bg-red-500' : 'bg-blue-500'} text-white rounded`}
            onClick={isMinimized ? handleConfirmClose : handleClose}
          >
            {isMinimized ? 'Emu still running, sure?' : status === 'running' ? 'Minimize' : 'Close'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
