import { cssBundleHref } from '@remix-run/css-bundle'
import { json, type LinksFunction, type MetaFunction } from '@remix-run/node'
import { Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData, useMatches, Link, useFetcher, useRouteError, useNavigate } from '@remix-run/react' // prettier-ignore
import React, { useState, useEffect, useRef } from 'react'
import electron from '~/electron.server'
import reactTabsStyles from 'react-tabs/style/react-tabs.css'
import { Menu, MenuItem, MenuButton, SubMenu, MenuDivider } from '@szhsin/react-menu'
import { Tree } from 'react-arborist'
import Split from 'react-split'
import { platform } from 'os'

import tailwindStyles from '~/styles/tailwind.css'
import reactSplitStyles from '~/styles/react-split.css'
import styles from '~/styles/styles.css'
import reactMenuStyles from '@szhsin/react-menu/dist/index.css'
import reactMenuTransitionStyles from '@szhsin/react-menu/dist/transitions/slide.css'

import { scanFolder } from '~/makeSidebarData.server'
import { Node } from '~/components/Node'
import { dataDirectory, dataDirectoryExists, datsDirectory, getTempDirectory } from '~/dataLocations.server'
import { cleanupTempDirectories } from '~/utils/tempManager.server'
import { CleanupButton } from '~/components/CleanupButton'

//configure and export logging per-domain feature
//todo: user-enablable - split out to json/global flag?)
import { createFeatureLogger } from '~/utils/featureLogger'
import loggerConfig from '../loggerConfig.json'
import { decodeString } from '~/utils/safeUrl' //for pretty printing
export const logger = createFeatureLogger(loggerConfig)

export const meta: MetaFunction = () => [{ title: 'QuickPlay Frontend' }]

export const links: LinksFunction = () => [
  ...(cssBundleHref ? [{ rel: 'stylesheet', href: cssBundleHref }] : []),
  { rel: 'stylesheet', href: styles },
  { rel: 'stylesheet', href: tailwindStyles },
  { rel: 'stylesheet', href: reactSplitStyles },
  { rel: 'stylesheet', href: reactTabsStyles },
  { rel: 'stylesheet', href: reactMenuStyles },
  { rel: 'stylesheet', href: reactMenuTransitionStyles }
]

export async function loader() {
  logger.log('remixRoutes', 'in the root loader')

  // Run temp directory cleanup on app startup
  try {
    const cleanup = await cleanupTempDirectories()
    if (cleanup.deletedFolders > 0) {
      logger.log(
        'fileOperations',
        `Startup cleanup: removed ${cleanup.deletedFolders} folders (${cleanup.freedSpaceMB} MB)`
      )
    }
  } catch (err) {
    logger.log('fileOperations', `Startup cleanup failed: ${err}`)
    // Continue with normal startup even if cleanup fails
  }
  const folderData = dataDirectoryExists() ? await scanFolder(dataDirectory) : []
  const tempDirectory = getTempDirectory()

  // Add platform detection here in the server-side code - idea is on windows we can perhaps remive the nav bar and use the menu bar?
  const currentPlatform = platform()
  const isWindows = currentPlatform === 'win32'
  const isMacOS = currentPlatform === 'darwin'
  const isLinux = currentPlatform === 'linux'

  return json({
    folderData,
    userDataPath: electron.app.getPath('userData'),
    tempDirectory,
    dataDirectory,
    datsDirectory,
    dataDirectoryExists: dataDirectoryExists(),
    isWindows,
    isMacOS,
    isLinux
  })
}

// Add an action to handle opening the temp directory
export async function action({ request }: { request: Request }) {
  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'openTempDirectory') {
    const pathToOpen = formData.get('path')?.toString() || ''
    try {
      await electron.shell.openPath(pathToOpen)
      return json({ success: true })
    } catch (error) {
      console.error('Failed to open directory:', error)
      return json({ success: false, error: error.message })
    }
  }

  return json({ success: false, error: 'Unknown intent' })
}

// use as the standard delay across the app
const HOVER_DELAY_MS = 400;

const ActionBar = ({ 
  isWindows, 
  isMacOS, 
  isLinux, 
  isMenuExpanded, 
  onExpandChange 
}) => {
  const [isFullScreen, setIsFullScreen] = useState(false)
  const isFirstDevToolsClick = useRef(true)
  // Add ref for the menu hover timeout
  const menuHoverTimeout = useRef(null);

  // Listen for fullscreen changes using the standard browser API
  useEffect(() => {
    // Check initial fullscreen state
    setIsFullScreen(!!document.fullscreenElement)
    console.log('Initial fullscreen state:', !!document.fullscreenElement)

    // Handler for fullscreen change events
    const handleFullscreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement)
      console.log('Fullscreen change detected:', !!document.fullscreenElement)
    }

    // Handler for custom events from Electron
    const handleElectronFullscreenChange = event => {
      console.log('Electron fullscreen change:', event.detail)
      setIsFullScreen(event.detail)
    }

    // Listen for both standard and vendor-prefixed fullscreen events
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    window.addEventListener('electron-fullscreen-change', handleElectronFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      window.removeEventListener('electron-fullscreen-change', handleElectronFullscreenChange)
    }
  }, [])

  // Add a separate effect to log when isFullScreen actually changes
  useEffect(() => {
    console.log('fullscreen is now:', isFullScreen)
  }, [isFullScreen])

  // Add a cleanup effect for the timeout
  useEffect(() => {
    return () => {
      if (menuHoverTimeout.current) {
        clearTimeout(menuHoverTimeout.current);
      }
    };
  }, []);

  // Create handler functions for mouse enter/leave
  const handleMouseEnter = () => {
    if (menuHoverTimeout.current) {
      clearTimeout(menuHoverTimeout.current);
    }
    menuHoverTimeout.current = setTimeout(() => {
      onExpandChange(true);
    }, HOVER_DELAY_MS);
  };

  const handleMouseLeave = () => {
    if (menuHoverTimeout.current) {
      clearTimeout(menuHoverTimeout.current);
    }
    onExpandChange(false);
  };

  // Window control functions
  const minimizeWindow = () => {
    // Using Remix-friendly approach to call electron
    const formData = new FormData()
    formData.append('intent', 'window-minimize')
    fetch('/api/electron', { method: 'POST', body: formData })
  }

  const maximizeWindow = () => {
    const formData = new FormData()
    formData.append('intent', 'window-maximize')
    fetch('/api/electron', { method: 'POST', body: formData })
  }

  const closeWindow = () => {
    const formData = new FormData()
    formData.append('intent', 'window-close')
    fetch('/api/electron', { method: 'POST', body: formData })
  }

  const toggleFullScreen = () => {
    // Just send the toggle request to Electron, let the event listeners
    // handle updating our state
    const formData = new FormData()
    formData.append('intent', 'toggle-fullscreen')
    fetch('/api/electron', { method: 'POST', body: formData })
  }

  const toggleDevTools = () => {
    const formData = new FormData()
    formData.append('intent', 'toggle-devtools')
    
    // If this is the first click since loading the app
    if (isFirstDevToolsClick.current) {
      // Send two requests with a tiny delay between them
      // The first "wakes up" the DevTools system, the second actually toggles it
      fetch('/api/electron', { method: 'POST', body: formData })
      setTimeout(() => {
        fetch('/api/electron', { method: 'POST', body: formData })
        isFirstDevToolsClick.current = false
      }, 50)
    } else {
      // For all subsequent clicks, just send one request
      fetch('/api/electron', { method: 'POST', body: formData })
    }
  }

  const zoomIn = () => {
    const formData = new FormData()
    formData.append('intent', 'zoom-in')
    fetch('/api/electron', { method: 'POST', body: formData })
  }

  const zoomOut = () => {
    const formData = new FormData()
    formData.append('intent', 'zoom-out')
    fetch('/api/electron', { method: 'POST', body: formData })
  }

  const zoomReset = () => {
    const formData = new FormData()
    formData.append('intent', 'zoom-reset')
    fetch('/api/electron', { method: 'POST', body: formData })
  }

  const reload = event => {
    const formData = new FormData()
    // Check if shift is pressed for force reload
    if (event.shiftKey) {
      formData.append('intent', 'force-reload')
    } else {
      formData.append('intent', 'reload')
    }
    fetch('/api/electron', { method: 'POST', body: formData })
  }

  return (
    <div
      className={`fixed top-0 left-0 w-full bg-white border-b border-gray-300 shadow-sm z-50 transition-all duration-300 ${
        isFullScreen ? 'h-6 hover:h-10 overflow-hidden' : isMenuExpanded ? 'h-10' : 'h-6'
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ WebkitAppRegion: isWindows ? 'drag' : 'no-drag' }}
    >
      {/* Collapsed view - make it fade out smoothly */}
      <div
        className={`px-4 pt-0.5 flex items-center justify-between absolute top-0 left-0 w-full ${
          isMenuExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'
        } transition-opacity duration-150`}
      >
        <div className="flex items-center">
          <span className="text-sm font-medium">QuickPlay</span>
          <span className="text-xs text-gray-400 ml-2">hover for menu</span>
        </div>
      </div>

      {/* Expanded view - remove the delay that's causing the flash */}
      <div
        className={`px-4 py-1 flex items-center justify-between absolute top-0 left-0 w-full ${
          isMenuExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'
        } transition-opacity duration-150`}
      >
        {/* Left side content */}
        <div className="flex items-center space-x-2" style={{ WebkitAppRegion: 'no-drag' }}>
          <span className="text-sm font-medium mr-3">QuickPlay</span>
          <button className="px-2 py-1 text-sm rounded hover:bg-gray-200 flex items-center">
            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            Home
          </button>
          <button className="px-2 py-1 text-sm rounded hover:bg-gray-200 flex items-center">
            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            Games
          </button>
          <button className="px-2 py-1 text-sm rounded hover:bg-gray-200 flex items-center">
            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
              />
            </svg>
            Systems
          </button>

          {/* Add fullscreen toggle */}
          <button
            className="px-2 py-1 text-sm rounded hover:bg-gray-200 flex items-center"
            onClick={toggleFullScreen}
            title={isMacOS ? "Toggle Fullscreen (⌃⌘F)" : "Toggle Fullscreen (F11)"}
          >
            {isFullScreen ? (
              <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
                />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
                />
              </svg>
            )}
            Fullscreen
          </button>

          <button
            className="px-2 py-1 text-sm rounded hover:bg-gray-200 flex items-center"
            onClick={toggleDevTools}
            title={isMacOS 
              ? "Developer Tools (⌥⌘I)" 
              : isLinux 
                ? "Developer Tools (F12 or Ctrl+Shift+I)" 
                : "Developer Tools (F12)"}
          >
            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
            Dev Tools
          </button>

          {/* Add zoom controls */}

          <button
            className="px-2 py-1 text-sm rounded hover:bg-gray-200 flex items-center"
            onClick={zoomOut}
            title={isMacOS ? "Zoom Out (⌘-)" : "Zoom Out (Ctrl+-)"}
          >
            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 13h4m-4 0H6"
              />
            </svg>
            Zoom Out
          </button>

          <button
            className="px-2 py-1 text-sm rounded hover:bg-gray-200 flex items-center"
            onClick={zoomIn}
            title={isMacOS ? "Zoom In (⌘+)" : "Zoom In (Ctrl+)"}
          >
            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v4m0 0v4m0-4h4m-4 0H6"
              />
            </svg>
            Zoom In
          </button>



          <button
            className="px-2 py-1 text-sm rounded hover:bg-gray-200 flex items-center"
            onClick={zoomReset}
            title={isMacOS ? "Reset Zoom (⌘0)" : "Reset Zoom (Ctrl+0)"}
          >
            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 10.3v.7l.7.7h2.6l.7-.7v-.7l-.7-.7h-2.6l-.7.7z"
              />
            </svg>
            Reset Zoom
          </button>

          <button
            className="px-2 py-1 text-sm rounded hover:bg-gray-200 flex items-center"
            onClick={reload}
            title={isMacOS 
              ? "Reload (⌘R) - Hold Shift for Force Reload (⇧⌘R)" 
              : "Reload (Ctrl+R) - Hold Shift for Force Reload (Ctrl+Shift+R)"}
          >
            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Reload
          </button>
        </div>

        {/* Right side with window controls for Windows */}
        <div className="flex items-center space-x-1">
          <Link
            to="convert"
            className="px-2 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
          >
            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            Import
          </Link>

          <button className="px-2 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300 flex items-center">
            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>

          <button className="p-1 rounded hover:bg-gray-200" title="Search">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </button>

          {/* Add Windows window controls - only when in fullscreen */}
          {isWindows && isFullScreen && (
            <div className="flex items-center ml-4" style={{ WebkitAppRegion: 'no-drag' }}>
              <button
                onClick={minimizeWindow}
                className="w-10 h-8 flex items-center justify-center hover:bg-gray-200 focus:outline-none"
                title="Minimize"
              >
                <div className="w-3 h-0.5 bg-gray-600"></div>
              </button>
              <button
                onClick={maximizeWindow}
                className="w-10 h-8 flex items-center justify-center hover:bg-gray-200 focus:outline-none"
                title="Maximize"
              >
                <div className="w-3 h-3 border border-gray-600"></div>
              </button>
              <button
                onClick={closeWindow}
                className="w-10 h-8 flex items-center justify-center hover:bg-red-500 hover:text-white focus:outline-none"
                title="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function TreeView({ folderData }) {
  const containerRef = useRef(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const lastDataRef = useRef(null)
  const [treeKey, setTreeKey] = useState(0)

  //if we use the romdata import, re-render the tree, otherwise don't (temporary solution)
  useEffect(() => {
    // Function to get structural data (ignoring state)
    const getStructure = data => {
      return JSON.stringify(
        data.map(item => ({
          name: item.name,
          romdataLink: item.romdataLink,
          children: item.children?.map(c => ({ name: c.name, romdataLink: c.romdataLink }))
        }))
      )
    }
    const currentStructure = getStructure(folderData)
    const lastStructure = lastDataRef.current ? getStructure(lastDataRef.current) : null
    if (lastStructure !== currentStructure) {
      console.log('detected actual folder structure change')
      lastDataRef.current = folderData
      setTreeKey(prev => prev + 1)
    }
  }, [folderData])

  useEffect(() => {
  // Tree component needs explicit pixel dimensions to render correctly,
  // ResizeObserver ensures it updates when container size changes
    const observer = new ResizeObserver(([entry]) => setDimensions(entry.contentRect))
    containerRef.current && observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div 
      ref={containerRef} 
      className="py-1.5 pl-3 h-full overflow-hidden" 
      style={{ width: '100%' }}
    >
      <Tree
        key={treeKey}
        initialData={folderData}
        openByDefault={false}
        width={dimensions.width}
        height={dimensions.height}
        rowHeight={42}
        indent={16} // Control indentation explicitly
      >
        {Node}
      </Tree>
    </div>
  )
}

// In your App component, update the footer with proper hover delay handling
export default function App() {
  logger.log('remixRoutes', 'in the root component')
  const data = useLoaderData<typeof loader>()
  const folderData = data.folderData
  const matches = useMatches()
  let match = matches.find(match => match?.data && 'romdata' in match.data)
  const [isSplitLoaded, setIsSplitLoaded] = useState(false)
  const fetcher = useFetcher()
  const [showFooterDetails, setShowFooterDetails] = useState(false)
  const [isMenuExpanded, setIsMenuExpanded] = useState(false)
  // Add footer hover timeout ref
  const footerHoverTimeout = useRef(null);

  const isWindows = data.isWindows
  const isMacOS = data.isMacOS
  const isLinux = data.isLinux

  useEffect(() => setIsSplitLoaded(true), [])

  // Function to open the temp directory using the action
  const openTempDirectory = () => {
    const formData = new FormData()
    formData.append('intent', 'openTempDirectory')
    formData.append('path', data.tempDirectory) //we could just call getTempDir from the action
    fetcher.submit(formData, { method: 'post' })
  }

  // Calculate header height based on menu state
  const headerHeight = isMenuExpanded ? 40 : 24; // 40px when expanded, 24px when collapsed
  
  // Pass state and setter to ActionBar
  const handleMenuExpandChange = (expanded) => {
    setIsMenuExpanded(expanded);
    
    // Dispatch a custom event that nested components can listen for
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('menuexpandchange', { 
        detail: expanded 
      }));
    }
  };

  // Add useEffect for cleanup
  useEffect(() => {
    return () => {
      if (footerHoverTimeout.current) {
        clearTimeout(footerHoverTimeout.current);
      }
    };
  }, []);

  // Add handler functions for footer mouse events
  const handleFooterMouseEnter = () => {
    if (footerHoverTimeout.current) {
      clearTimeout(footerHoverTimeout.current);
    }
    footerHoverTimeout.current = setTimeout(() => {
      setShowFooterDetails(true);
    }, HOVER_DELAY_MS);
  };

  const handleFooterMouseLeave = () => {
    if (footerHoverTimeout.current) {
      clearTimeout(footerHoverTimeout.current);
    }
    setShowFooterDetails(false);
  };

  return (
    <html lang="en" className="w-full h-full">
      <head>
        <meta charSet="utf8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="w-full h-full m-0 p-0 overflow-hidden">
        <>
          <div id="root"></div> {/* Set the app element for react-modal */}
          <ActionBar
            isWindows={isWindows}
            isMacOS={isMacOS}
            isLinux={isLinux}
            onExpandChange={handleMenuExpandChange}
            isMenuExpanded={isMenuExpanded}
          />
          {isSplitLoaded && (
            <>
              <Split
                sizes={[18, 82]}
                className="flex overflow-hidden transition-all duration-300"
                style={{
                  height: `calc(100vh - ${headerHeight}px - 30px)`, // Dynamic height based on header
                  marginTop: `${headerHeight}px` // Dynamic margin based on header height
                }}
              >
                <TreeView folderData={folderData} />
                <div className="h-full overflow-auto">
                  {data.dataDirectoryExists ? (
                    <Outlet />
                  ) : (
                    <>
                      <div className="flex items-center justify-center h-full">
                        <h1 className="text-2xl font-bold">No romdata found. Please set up your romdata directory.</h1>
                      </div>
                      <Outlet />
                    </>
                  )}
                </div>
              </Split>

              {/* Improved footer with hover effect */}
              <div
                className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 shadow-md transition-all duration-300 z-50"
                style={{ height: showFooterDetails ? '100px' : '30px' }}
                onMouseEnter={handleFooterMouseEnter}
                onMouseLeave={handleFooterMouseLeave}
              >
                {/* Always visible minimal info */}
                <div className="px-4 py-1 flex items-center justify-between">
                  <div className="text-xs font-mono">Games in path: {match?.data?.romdata.length ?? 0}</div>
                  <div className="text-xs opacity-50">Hover for details</div>
                </div>

                {/* Expanded details section */}
                <div
                  className={`px-4 py-2 ${
                    showFooterDetails ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  } transition-opacity duration-300`}
                >
                  <div className="flex justify-between items-center">
                    <div className="space-y-1">
                      <div className="text-xs font-mono">
                        Data directory: {data.dataDirectory}: Dats directory: {data.datsDirectory}
                      </div>
                      <div className="text-xs font-mono">Temp directory: {data.tempDirectory}</div>
                      {process.env.NODE_ENV === 'development' && (
                        <div className="text-xs font-mono">
                          Current URL: {decodeURIComponent(decodeString(window.location.href))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-3">
                      <button
                        onClick={openTempDirectory}
                        className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none flex items-center"
                        title="Open temp directory where extracted game files are stored"
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
                            d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
                          ></path>
                        </svg>
                        Open Temp Dir
                      </button>
                      <CleanupButton />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
        <ScrollRestoration />
        <Scripts />
        {process.env.NODE_ENV === 'development' && <LiveReload />}
      </body>
    </html>
  )
}

export function ErrorBoundary() {
  const error = useRouteError()
  const navigate = useNavigate()
  const matches = useMatches()
  console.error(error)

  // Inline decoding functions - making the error boundary self-contained
  function internalDecodeString(str) {
    if (!str) return ''
    // simplified version of decoder that handles most common tokens
    const SPECIAL_CHARS_MAP = {
      '\\': '__BSLASH__',
      '%': '__PERCENT__',
      '~': '__TILDE__',
      '#': '__HASH__',
      '?': '__QMARK__',
      '/': '__FSLASH__',
      ':': '__COLON__'
    }
    return str.replace(/__BSLASH__|__PERCENT__|__TILDE__|__HASH__|__QMARK__|__FSLASH__|__COLON__/g, match => {
      for (const [char, token] of Object.entries(SPECIAL_CHARS_MAP)) {
        if (token === match) return char
      }
      return match
    })
  }
  function internalDecodeFullUrl(url) {
    try {
      return decodeURIComponent(internalDecodeString(url))
    } catch (e) {
      return url // Fallback to original if decoding fails
    }
  }
  // ensure we have a proper error object with stack
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
  const errorStack = error instanceof Error ? error.stack : JSON.stringify(error, null, 2)
  const timestamp = new Date().toISOString()
  // Get additional diagnostic information
  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'Server-side error'
  const currentRoute = matches.length > 0 ? matches[matches.length - 1]?.pathname : 'Unknown route'
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Server-side error'
  const platformInfo = typeof navigator !== 'undefined' ? navigator.platform : 'Server-side error'
  const goBack = () => navigate(-1)
  const goHome = () => navigate('/')
  return (
    <html lang="en" className="w-full h-full">
      <head>
        <meta charSet="utf8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
        <title>Error | QuickPlay</title>
      </head>
      <body className="w-full h-full bg-gray-50">
        <div className="p-4 md:p-8 max-w-full mx-auto">
          {' '}
          {/* Made wider */}
          <div className="bg-white shadow-lg rounded-lg overflow-hidden max-w-full">
            <div className="p-6 bg-red-500 text-white">
              <h1 className="text-2xl font-bold">Application Error - if you want it to not happen, report it to us!</h1>
              <p className="mt-2 text-red-100">{errorMessage}</p>
              <div className="mt-2 opacity-75 text-xs font-mono">{timestamp}</div>
            </div>

            <div className="p-6">
              <div className="mb-6 flex space-x-4">
                <button
                  onClick={goBack}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                >
                  ← Go Back
                </button>
                <button
                  onClick={goHome}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
                >
                  Go Home
                </button>
              </div>

              {/* Diagnostic Information Section */}
              <div className="mb-6 border-b border-gray-200 pb-4">
                <h2 className="text-lg font-semibold mb-2">Diagnostic Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="font-semibold">URL:</span>{' '}
                    <span className="font-mono break-all">
                      {typeof currentUrl === 'string' ? internalDecodeFullUrl(currentUrl) : currentUrl}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold">Route:</span>{' '}
                    <span className="font-mono">
                      {typeof currentRoute === 'string' ? internalDecodeFullUrl(currentRoute) : currentRoute}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold">Time:</span> <span className="font-mono">{timestamp}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Platform:</span> <span className="font-mono">{platformInfo}</span>
                  </div>
                  <div className="col-span-full">
                    <span className="font-semibold">User Agent:</span>{' '}
                    <span className="font-mono break-all">{userAgent}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h2 className="text-lg font-semibold mb-2">Error Details</h2>
                <pre className="bg-gray-100 p-4 rounded overflow-auto text-xs max-h-[50vh]">{errorStack}</pre>
              </div>
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-gray-500">View raw error object</summary>
                <pre className="text-xs mt-2 p-2 bg-gray-900 text-gray-100 rounded overflow-auto">
                  {typeof error === 'object' && error !== null && Object.keys(error).length > 0
                    ? JSON.stringify(error, null, 2)
                    : 'Error object is empty or not available'}
                </pre>
              </details>
            </div>
          </div>
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}
