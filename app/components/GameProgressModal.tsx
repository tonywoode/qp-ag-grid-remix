import Modal from 'react-modal'
import { useEffect, useRef, useState } from 'react'
import { useEventSource } from 'remix-utils/sse/react'
import { useFetcher } from '@remix-run/react'

type ProgressModalProps = {
  isOpen: boolean
  onClose: () => void
  gameDetails: {
    name: string
    path: string
    status: string
    logs: string[]
  }
}

export function GameProgressModal({ isOpen, onClose, gameDetails }: ProgressModalProps) {
  const fetcher = useFetcher()
  const containerRef = useRef<HTMLDivElement>(null)
  const [logs, setLogs] = useState<string[]>(gameDetails.logs)
  const [status, setStatus] = useState<string>(gameDetails.status)
  const [isMinimized, setIsMinimized] = useState(false)
  const hasError = logs.some(log => log.toLowerCase().includes('error'))
  const eventData = useEventSource('/stream', { event: 'runGameEvent' })

  useEffect(() => {
    console.log('the eventData useEffect ran')
    if (eventData) {
      const data = JSON.parse(eventData)
      console.log('runGame event:', data)
      setLogs(prevLogs => [...prevLogs, data.data])
      if (data.type === 'status') {
        console.log('Setting status to:', data.data)
        setStatus(data.data)
        if (data.data === 'closed') {
          setIsMinimized(false)
        }
      }
      if (data.type === 'onlyOneEmu') {
        alert(data.data)
      }
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

  const handleClose = () => {
    if (status === 'running') {
      setIsMinimized(true)
    } else {
      onClose()
    }
  }

  const handleConfirmClose = () => {
    fetcher.submit({ clearProcess: true }, { action: '/runGame', method: 'post', encType: 'application/json' })
    setIsMinimized(false)
    onClose()
  }

  return (
    <>
      <Modal
        isOpen={isOpen && !isMinimized}
        onRequestClose={handleClose}
        contentLabel="Game Progress"
        className="inline-flex w-1/2 h-1/2"
        overlayClassName="fixed w-full h-screen top-0 left-0 z-[1000] bg-opacity-20 bg-white backdrop-blur-[1.2px] flex justify-center items-center"
        shouldCloseOnEsc={false} //because esc exits emulators like retroarch, hold it down for 2ms too long and....
      >
        <div className="relative bg-white rounded w-full h-full mx-auto p-6 flex flex-col">
          {/* Header with summaries */}
          <div className="flex flex-col p-3 border-b border-gray-200">
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
          <div
            ref={containerRef}
            className="flex-grow overflow-auto bg-black text-white p-4 rounded whitespace-pre-wrap"
          >
            {logs.map((log, i) => (
              <div key={i}>
                {
                  //an event can have multiple log lines, we only want to colour the error lines in red (works well for retroarch)
                  log.split('\n').map((line, j) => (
                    <div
                      key={j}
                      className={`${line.toLowerCase().includes('error') ? 'text-red-500' : 'text-green-500'}`}
                    >
                      {line}
                    </div>
                  ))
                }
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-2">
            <button className="px-4 py-1 bg-blue-500 text-white rounded" onClick={handleClose}>
              {status === 'running' ? 'Minimize' : 'Close'}
            </button>
          </div>
        </div>
      </Modal>
      {isMinimized && (
        <div className="fixed bottom-4 right-4 w-1/4 h-1/4 z-[1001] bg-white border border-gray-300 rounded shadow-lg p-4 flex flex-col">
          <div className="flex justify-between items-center">
            <span className="font-medium text-gray-800">{gameDetails.name}</span>
            <button className="px-2 py-1 bg-red-500 text-white rounded" onClick={handleConfirmClose}>
              Emu still running, sure?
            </button>
          </div>
          <div className="flex-grow overflow-auto bg-black text-white p-4 rounded whitespace-pre-wrap mt-2">
            {logs.map((log, i) => (
              <div key={i}>
                {
                  //an event can have multiple log lines, we only want to colour the error lines in red (works well for retroarch)
                  log.split('\n').map((line, j) => (
                    <div
                      key={j}
                      className={`${line.toLowerCase().includes('error') ? 'text-red-500' : 'text-green-500'}`}
                    >
                      {line}
                    </div>
                  ))
                }
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
