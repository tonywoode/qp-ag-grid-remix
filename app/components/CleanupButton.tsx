import { useState } from 'react'
import { useFetcher } from '@remix-run/react'

export function CleanupButton() {
  const fetcher = useFetcher()
  const [showResult, setShowResult] = useState(false)
  
  const handleClick = () => {
    // Pass a special parameter to indicate we want a full cleanup (maxDays=0)
    fetcher.submit({ fullCleanup: 'true' }, { method: 'post', action: '/cleanup' })
    // Show result for 3 seconds
    setShowResult(true)
    setTimeout(() => setShowResult(false), 3000)
  }

  const isLoading = fetcher.state === 'submitting'
  const result = fetcher.data

  return (
    <div className="relative mr-2">
      <button
        onClick={handleClick}
        disabled={isLoading}
        className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none flex items-center disabled:bg-blue-300"
        title="Clean up all extracted game files from temp directory"
      >
        <svg
          className="w-4 h-4 mr-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
        {isLoading ? 'Cleaning...' : 'Clean Temp Files'}
      </button>

      {showResult && result && !result.error && (
        <div className="absolute bottom-full mb-2 p-2 bg-green-100 text-green-800 rounded shadow-md z-10 whitespace-normal right-0 max-w-xs text-sm">
          {result.fullCleanup
            ? `Removed all extracted game files (${result.freedSpaceMB} MB)`
            : `Cleaned ${result.deletedFolders} folders (${result.freedSpaceMB} MB)`}
        </div>
      )}

      {showResult && result && result.error && (
        <div className="absolute bottom-full mb-2 p-2 bg-red-100 text-red-800 rounded shadow-md z-10 whitespace-normal right-0 max-w-xs text-sm">
          Error: {result.error}
        </div>
      )}
    </div>
  )
}