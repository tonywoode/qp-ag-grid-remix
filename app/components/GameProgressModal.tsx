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
  const eventData = useEventSource('/stream', { event: 'runGameEvent' })

  useEffect(() => {
    if (eventData) {
      const data = JSON.parse(eventData)
      console.log('runGame event:', data)
      setLogs(prevLogs => [...prevLogs, data.data])
      setStatus(data.data)
    }
  }, [eventData])

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
        <h2 className="text-lg font-medium">Running {gameDetails.name}</h2>
        <p className="mt-2 text-sm text-gray-500">{status}</p>
        <div ref={containerRef} className="mt-4 h-64 overflow-auto bg-black text-white p-4 rounded whitespace-pre-wrap">
          {logs.map((log, i) => (
            <div key={i} className={`${log.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>
              {log}
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
