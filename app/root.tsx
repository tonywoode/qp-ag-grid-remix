import { cssBundleHref } from '@remix-run/css-bundle'
import { json, type LinksFunction, type MetaFunction } from '@remix-run/node'
import { Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData, useMatches, Link, useFetcher } from '@remix-run/react' // prettier-ignore
import React, { useState, useEffect, useRef } from 'react'
import electron from '~/electron.server'
import reactTabsStyles from 'react-tabs/style/react-tabs.css'
import { Menu, MenuItem, MenuButton, SubMenu, MenuDivider } from '@szhsin/react-menu'
import { Tree } from 'react-arborist'
import Split from 'react-split'

import tailwindStyles from '~/styles/tailwind.css'
import reactSplitStyles from '~/styles/react-split.css'
import styles from '~/styles/styles.css'
import reactMenuStyles from '@szhsin/react-menu/dist/index.css'
import reactMenuTransitionStyles from '@szhsin/react-menu/dist/transitions/slide.css'

import { scanFolder } from '~/makeSidebarData.server'
import { Node } from '~/components/Node'
//TODO: you'd expect the root.tsx to want to know if the dats directory exists, but it delegates this entirely
import { dataDirectory, dataDirectoryExists, getTempDirectory } from '~/dataLocations.server'

//configure and export logging per-domain feature
//todo: user-enablable - split out to json/global flag?)
import { createFeatureLogger } from '~/utils/featureLogger'
import loggerConfig from '../loggerConfig.json'
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
  const folderData = dataDirectoryExists() ? await scanFolder(dataDirectory) : []
  const tempDirectory = getTempDirectory()
  return json({
    folderData,
    userDataPath: electron.app.getPath('userData'),
    tempDirectory,
    dataDirectoryExists: dataDirectoryExists()
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

const menu = () => (
  <Menu menuButton={<MenuButton className="box-border border-2 border-gray-500 rounded px-2 m-3">Menu</MenuButton>}>
    <MenuItem>New File</MenuItem>
    <SubMenu label="Edit">
      <MenuItem>Cut</MenuItem>
      <MenuItem>Copy</MenuItem>
      <MenuItem>Paste</MenuItem>
      <SubMenu label="Find">
        <MenuItem>Find...</MenuItem>
        <MenuItem>Find Next</MenuItem>
        <MenuItem>Find Previous</MenuItem>
      </SubMenu>
    </SubMenu>
    <MenuDivider className="h-px bg-gray-200 mx-2.5 my-1.5" />
    <MenuItem>Print...</MenuItem>
  </Menu>
)

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
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
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

  useEffect(() => setIsSplitLoaded(true), [])

  // Function to open the temp directory using the action
  const openTempDirectory = () => {
    const formData = new FormData()
    formData.append('intent', 'openTempDirectory')
    formData.append('path', data.tempDirectory) //we could just call getTempDir from the action
    fetcher.submit(formData, { method: 'post' })
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <>
          <div id="root"></div> {/* Set the app element for react-modal */}
          <div className="flex flex-row">
            {menu()}
            <Link to="convert" className="box-border border-2 border-gray-500 px-2 m-3">
              Import Original QP Data
            </Link>
          </div>
          {isSplitLoaded && (
            <>
              <Split sizes={[18, 82]} className="flex overflow-hidden" style={{ height: 'calc(100vh - 7em)' }}>
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
                  <div className="text-xs font-mono">
                    Games in path: {match?.data?.romdata.length ?? 0}
                  </div>
                  <div className="text-xs opacity-50">Hover for details</div>
                </div>
                
                {/* Expanded details section */}
                <div className={`px-4 py-2 ${showFooterDetails ? 'opacity-100' : 'opacity-0 pointer-events-none'} transition-opacity duration-300`}>
                  <div className="flex justify-between items-center">
                    <div className="space-y-1">
                      <div className="text-xs font-mono">User data path: {data.userDataPath}</div>
                      <div className="text-xs font-mono">Temp directory: {data.tempDirectory}</div>
                      {process.env.NODE_ENV === 'development' && (
                        <div className="text-xs font-mono">Current URL: {window.location.href}</div>
                      )}
                    </div>
                    
                    <div>
                      <button
                        onClick={openTempDirectory}
                        className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none flex items-center"
                        title="Open temp directory where extracted game files are stored"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"></path>
                        </svg>
                        Open Temp Dir
                      </button>
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
