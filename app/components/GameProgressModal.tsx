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
  eventData: string | null
}

const MINIMIZED_HEIGHT_REM = 20

const DEFAULT_POSITIONS = {
  minimized: { x: '1vw', y: `calc(99vh - ${MINIMIZED_HEIGHT_REM}rem)` },
  maximized: { x: '50%', y: '50%' }
}

export function GameProgressModal({ isOpen, onClose, gameDetails, eventData }: ProgressModalProps) {
  const fetcher = useFetcher()
  const containerRef = useRef<HTMLDivElement>(null)
  const [logs, setLogs] = useState<{ type: string; data: string }[]>(gameDetails.logs)
  const [zipStatus, setZipStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [isZip, setIsZip] = useState(false)
  const [status, setStatus] = useState<string>(gameDetails.status)
  const [isMinimized, setIsMinimized] = useState(false)
  const [minimizedPosition, setMinimizedPosition] = useState(DEFAULT_POSITIONS.minimized)
  const [maximizedPosition, setMaximizedPosition] = useState(DEFAULT_POSITIONS.maximized)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const hasError = logs.some(log => log.data.toLowerCase().includes('error'))
  useEffect(() => {
    console.log('the eventData useEffect ran')
    if (eventData) {
      const data = JSON.parse(eventData)
      console.log('runGame event:', data)
      setLogs(prevLogs => [...prevLogs, data])
      if (data.type === 'status') {
        console.log('Setting status to:', data.data)
        setStatus(data.data)
        if (data.data === 'closed') setIsMinimized(false)
        if (data.data === 'zip-success') setZipStatus('success')
        else if (data.data.startsWith('zip-error')) setZipStatus('error')
        if (data.data === 'isZip') setIsZip(true)
      }
      if (data.type === 'onlyOneEmu') alert(data.data)
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
  }, [isOpen])

  function resetAllPositions() {
    setIsMinimized(false)
    setMinimizedPosition(DEFAULT_POSITIONS.minimized)
    setMaximizedPosition(DEFAULT_POSITIONS.maximized)
  }

  function updatePosition(mode: 'minimized' | 'maximized', pos: { x: number | string; y: number | string }) {
    if (mode === 'minimized') setMinimizedPosition(pos)
    else setMaximizedPosition(pos)
  }

  const handleClose = () => {
    if (status === 'running') setIsMinimized(true)
    else {
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
          transform: isMinimized ? 'none' : 'translate(-50%, -50%)',
          pointerEvents: 'auto',
          zIndex: 1001,
          maxHeight: isMinimized ? `${MINIMIZED_HEIGHT_REM}rem` : '80vh',
          overflow: 'auto'
        }
      }}
      overlayClassName={`fixed w-full h-screen top-0 left-0 z-[1000] ${
        isMinimized ? '' : 'backdrop-blur-[1.2px]'
      } flex justify-center items-center`}
      shouldCloseOnEsc={false} //because esc exits emulators like retroarch, hold it down for 2ms too long and....
    >
      <div
        className="relative bg-white rounded w-full h-full mx-auto p-6 flex flex-col"
        draggable="true"
        onMouseDown={e => {
          const rect = e.currentTarget.getBoundingClientRect()
          const offsetX = isMinimized ? e.clientX - rect.left : e.clientX - (rect.left + rect.width / 2)
          const offsetY = isMinimized ? e.clientY - rect.top : e.clientY - (rect.top + rect.height / 2)
          setDragOffset({ x: offsetX, y: offsetY })
          setDragStart({ x: e.clientX, y: e.clientY })
        }}
        onDragStart={e => {
          e.dataTransfer.setData('text', '') //required for Firefox
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setDragImage(blankDragImage, 0, 0) //might as well be 0,0
        }}
        onDrag={e => {
          if (e.clientX === 0 && e.clientY === 0) return
          const newPosition = {
            x: (e?.clientX ?? dragStart.x) - dragOffset.x,
            y: (e?.clientY ?? dragStart.y) - dragOffset.y
          }
          const mode: 'minimized' | 'maximized' = isMinimized ? 'minimized' : 'maximized'
          updatePosition(mode, newPosition)
        }}
      >
        {/* Header with summaries */}
        <div className="flex flex-col p-3 border-b border-gray-200 cursor-move">
          <span className="font-medium text-gray-800">{gameDetails.name}</span>
          <div className="flex items-center space-x-2 mt-2">
            <div className="flex items-center">
              <span className="mr-2 text-sm text-gray-600">Unzip:</span>
              {hasError ? <span className="text-red-500">✗</span> : <span className="text-green-500">✓</span>}
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
        <div ref={containerRef} className="flex-grow overflow-auto bg-black text-white p-4 rounded whitespace-pre-wrap">
          {logs.map(({ type, data }, i) => (
            <div key={i}>
              {
                //an event can have multiple log lines, we only want to colour the error lines in red (works well for retroarch)
                data.split('\n').map((line, j) => (
                  <div
                    key={j}
                    className={`${line.toLowerCase().includes('error') ? 'text-red-500' : 'text-green-500'}`}
                  >
                    {line !== '' ? (
                      <div className="flex items-center">
                        {type.startsWith('Emu') && <IoGameControllerOutline className="mr-2 text-2xl" />}
                        {(type.startsWith('QPBackend') ||
                          type.startsWith('status') ||
                          type.startsWith('onlyOneEmu')) && <DiJsBadge className="mr-2 text-2xl" />}
                        {type.startsWith('zip') && isZip && (
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
                        {line}
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
        <div className="flex justify-end mt-2">
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
