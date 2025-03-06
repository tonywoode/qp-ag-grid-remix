import { cssBundleHref } from '@remix-run/css-bundle'
import { json, type LinksFunction, type MetaFunction } from '@remix-run/node'
import { Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData, useMatches, Link, useFetcher } from '@remix-run/react' // prettier-ignore
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

const ActionBar = ({ isWindows, isMacOS, isLinux }) => {
  return (
    <div className="fixed top-0 left-0 w-full bg-white border-b border-gray-300 shadow-sm z-50 h-10">
      <div className="px-4 py-1 flex items-center justify-between h-full">
        {/* Left side - Logo and primary navigation */}
        <div className="flex items-center space-x-2">
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
        </div>

        {/* Right side - action buttons */}
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
    const observer = new ResizeObserver(([entry]) => setDimensions(entry.contentRect))
    containerRef.current && observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="py-1.5" style={{ width: '100%', height: '100%' }}>
      <Tree
        key={treeKey}
        initialData={folderData}
        openByDefault={false}
        width={dimensions.width}
        height={dimensions.height}
        rowHeight={42}
      >
        {Node}
      </Tree>
    </div>
  )
}

export default function App() {
  logger.log('remixRoutes', 'in the root component')
  const data = useLoaderData<typeof loader>()
  const folderData = data.folderData
  const matches = useMatches()
  let match = matches.find(match => match?.data && 'romdata' in match.data)
  const [isSplitLoaded, setIsSplitLoaded] = useState(false)
  const fetcher = useFetcher()
  const [showFooterDetails, setShowFooterDetails] = useState(false)

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

  return (
    <html lang="en" className="w-full h-full">
      <head>
        <meta charSet="utf8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="w-full h-full m-2 p-2">
        <>
          <div id="root"></div> {/* Set the app element for react-modal */}
          {ActionBar({
            isWindows,
            isMacOS,
            isLinux
          })}
          {isSplitLoaded && (
            <>
              <Split
                sizes={[18, 82]}
                className="flex overflow-hidden"
                style={{
                  height: 'calc(100vh - 40px - 30px)', // 40px header height and 30px footer
                  marginTop: '23px' // Match the actual header height exactly
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
                onMouseEnter={() => setShowFooterDetails(true)}
                onMouseLeave={() => setShowFooterDetails(false)}
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
