import { useState, useEffect } from 'react'
import { useFetcher } from '@remix-run/react'

export function FileSelectionModal({ 
  isOpen, 
  files, 
  requestId, 
  archivePath,
  onClose 
}) {
  const [selectedFile, setSelectedFile] = useState(files[0] || '')
  const fetcher = useFetcher()
  
  // Submit the selected file
  const handleSubmit = () => {
    fetcher.submit(
      { requestId, selectedFile, cancelled: false },
      { method: 'post', action: '/selectFile', encType: 'application/json' }
    )
    onClose()
  }
  
  // Cancel the selection
  const handleCancel = () => {
    fetcher.submit(
      { requestId, cancelled: true },
      { method: 'post', action: '/selectFile', encType: 'application/json' }
    )
    onClose()
  }
  
  // Handle escape key
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape' && isOpen) {
        handleCancel()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen])
  
  if (!isOpen) return null
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
      style={{ zIndex: 2000 }} // Higher than GameProgressModal's 1001
      onClick={(e) => e.stopPropagation()} // Prevent clicks from bubbling up
    >
      <div 
        className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()} // Additional protection
      >
        <h2 className="text-xl font-semibold mb-4">Select File to Run</h2>
        <p className="mb-2 text-gray-600">Archive: {archivePath}</p>
        <div className="flex-grow overflow-auto mb-4">
          <div className="space-y-2">
            {files.map((file, index) => (
              <div 
                key={index}
                className={`p-2 border rounded cursor-pointer hover:bg-gray-100 ${
                  selectedFile === file ? 'bg-blue-100 border-blue-500' : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation(); // Stop event bubbling
                  setSelectedFile(file);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation(); // Stop event bubbling
                  setSelectedFile(file);
                  handleSubmit();
                }}
              >
                {file}
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end space-x-2">
          <button 
            className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
            onClick={(e) => {
              e.stopPropagation();
              handleCancel();
            }}
          >
            Cancel
          </button>
          <button 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={(e) => {
              e.stopPropagation();
              handleSubmit();
            }}
            disabled={!selectedFile}
          >
            Run Selected File
          </button>
        </div>
      </div>
    </div>
  )
}