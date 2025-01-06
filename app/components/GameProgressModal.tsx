import Modal from 'react-modal'
import { useEffect, useRef, useState } from 'react'
import { useEventSource } from 'remix-utils/sse/react'

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
  const containerRef = useRef<HTMLDivElement>(null)
  const [logs, setLogs] = useState<string[]>(gameDetails.logs)
  const [status, setStatus] = useState<string>(gameDetails.status)
  const hasError = logs.some(log => log.toLowerCase().includes('error'))
  const eventData = useEventSource('/stream', { event: 'runGameEvent' })

  useEffect(() => {
    if (eventData) {
      const data = JSON.parse(eventData)
      console.log('runGame event:', data)
      setLogs(prevLogs => [...prevLogs, data.data])
      setStatus(data.data)
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
  }, [isOpen])

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Game Progress"
      className="fixed inset-0 z-10 flex items-center justify-center"
      overlayClassName="fixed inset-0 bg-white bg-opacity-50"
    >
      <div className="relative bg-white rounded max-w-4xl w-full mx-auto p-6">
        {/* Header with summaries */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <span className="font-medium text-gray-800">{gameDetails.name}</span>
            <div className="flex items-center space-x-2">
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
          <div className="flex space-x-2">
            <button className="text-gray-500 hover:text-gray-700 px-2"></button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 px-2">
              ×
            </button>
          </div>
        </div>

        {/* Console Output */}
        <div ref={containerRef} className="mt-4 h-64 overflow-auto bg-black text-white p-4 rounded whitespace-pre-wrap">
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
        <div className="mt-4 flex justify-end">
          <button className="px-4 py-2 bg-blue-500 text-white rounded" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}
