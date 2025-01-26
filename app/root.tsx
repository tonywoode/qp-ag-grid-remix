import { cssBundleHref } from '@remix-run/css-bundle'
import { json, type LinksFunction, type MetaFunction } from '@remix-run/node'
import { Form, Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData, useMatches, useActionData, useNavigation } from '@remix-run/react' // prettier-ignore
import { useState, useEffect, useRef } from 'react'
import electron from '~/electron.server'
import reactTabsStyles from 'react-tabs/style/react-tabs.css'
import { Menu, MenuItem, MenuButton, SubMenu, MenuDivider } from '@szhsin/react-menu'
import { Tree } from 'react-arborist'
import Split from 'react-split'
import Modal from 'react-modal'
// import { Resizable, ResizableBox } from 'react-resizable'

import tailwindStyles from '~/styles/tailwind.css'
import reactSplitStyles from '~/styles/react-split.css'
import styles from '~/styles/styles.css'
import reactMenuStyles from '@szhsin/react-menu/dist/index.css'
import reactMenuTransitionStyles from '@szhsin/react-menu/dist/transitions/slide.css'

import { scanFolder } from '~/makeSidebarData.server'
import { Node } from '~/components/Node'
import { convertQuickPlayData, validateQuickPlayDirectory } from './utils/convertQuickPlayData.server'

//configure and export logging per-domain feature
//todo: user-enablable - split out to json/global flag?)
import { createFeatureLogger } from '~/utils/featureLogger'
const loggerConfig = [
  { feature: 'remixRoutes', enabled: false },
  { feature: 'gridOperations', enabled: false },
  { feature: 'fileOperations', enabled: false },
  { feature: 'goodMergeChoosing', enabled: false },
  { feature: 'screenshots', enabled: false },
  { feature: 'tabContent', enabled: false },
  { feature: 'icons', enabled: false },
  { feature: 'pathConversion', enabled: false },
  { feature: 'lightbox', enabled: false }
]
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
  const folderData = await scanFolder('./data')
  return json({ folderData, userDataPath: electron.app.getPath('userData') })
}

type ModalState = {
  isOpen: boolean
  selectedPath?: string
  isConverting?: boolean
  error?: string
  result?: {
    success: boolean
    message: string
  }
}

export const action = async ({ request }: { request: Request }) => {
  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'selectDirectory') {
    const result = await electron.dialog.showOpenDialog({
      message: "Select original QuickPlay install folder (should contain 'Data' and 'Dats' dirs)",
      properties: ['openDirectory']
    })

    if (result.canceled || !result.filePaths.length) {
      return json({ success: false, message: 'No folder selected' })
    }

    const sourcePath = result.filePaths[0]

    try {
      await validateQuickPlayDirectory(sourcePath)
      return json({
        success: true,
        path: sourcePath,
        message: `Selected: ${sourcePath}`
      })
    } catch (error) {
      return json({
        success: false,
        error: error.message
      })
    }
  }

  const sourcePath = formData.get('sourcePath')
  const action = formData.get('action')

  if (!sourcePath) {
    return json({ success: false, message: 'No path selected' })
  }

  try {
    const convertedFiles = await convertQuickPlayData(sourcePath.toString(), 'data', action?.toString() as BackupChoice)
    return json({
      success: true,
      path: sourcePath,
      message: `Successfully converted ${convertedFiles} romdata files`,
      complete: true // Add this flag to indicate completion
    })
  } catch (error) {
    if (error.message === 'EXISTING_DATA') {
      return json({
        success: false,
        path: sourcePath,
        message: 'EXISTING_DATA',
        existingData: true
      })
    }
    return json({ success: false, message: error.message })
  }
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

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setDimensions(entry.contentRect))
    containerRef.current && observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <Tree
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
  let match = matches.find(match => 'romdata' in match.data)
  const [isSplitLoaded, setIsSplitLoaded] = useState(false)
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false })

  useEffect(() => Modal.setAppElement('#root'), []) // Set the app element for react-modal (else it complains in console about aria)
  // sets isSplitLoaded after the initial render, to avoid flash of tabs while grid's rendering
  //TODO:  this is causing delay, using react-split-grid might be better https://github.com/nathancahill/split
  // but see this after trying, which will cause console error https://github.com/nathancahill/split/issues/573
  useEffect(() => {
    setIsSplitLoaded(true)
  }, [])

  // Effect to track form submission state
  useEffect(() => {
    if (navigation.state === 'submitting') {
      setModalState(prev => ({ ...prev, isConverting: true }))
    }
  }, [navigation.state])

  // Effect to handle action response
  useEffect(() => {
    if (actionData) {
      setModalState(prev => ({
        ...prev,
        isConverting: false,
        result: {
          success: actionData.success,
          message: actionData.message
        }
      }))
    }
  }, [actionData])

  // Update modal state based on form submission and response
  useEffect(() => {
    if (navigation.state === 'submitting') {
      setModalState(prev => ({ ...prev, isConverting: true, error: undefined }))
    } else if (actionData) {
      setModalState(prev => ({
        ...prev,
        isConverting: false,
        selectedPath: actionData.complete ? undefined : actionData.path, // Reset path on completion
        error: actionData.error,
        result: {
          success: actionData.success,
          message: actionData.message
        }
      }))
    }
  }, [navigation.state, actionData])

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
            <button
              onClick={() => setModalState({ isOpen: true })}
              className="box-border border-2 border-gray-500 px-2 m-3"
            >
              Convert Original QP Romdata
            </button>
          </div>
          <Modal
            isOpen={modalState.isOpen}
            onRequestClose={() => {
              if (!modalState.isConverting) {
                setModalState({ isOpen: false })
              }
            }}
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-lg shadow-lg"
            overlayClassName="fixed inset-0 bg-black/50"
          >
            <div className="w-[32rem]">
              <h2 className="text-xl font-bold mb-4">Converting QuickPlay Data</h2>

              {modalState.isConverting ? (
                <div className="flex items-center mb-4">
                  <div className="animate-spin mr-3 h-5 w-5 border-2 border-gray-500 border-t-transparent rounded-full"></div>
                  <p>Processing...</p>
                </div>
              ) : (
                <>
                  {!modalState.selectedPath ? (
                    <>
                      {modalState.result?.success ? (
                        <div className="mb-4">
                          <p className="text-green-600 mb-2">{modalState.result.message}</p>
                        </div>
                      ) : (
                        <>
                          <Form method="post">
                            <input type="hidden" name="intent" value="selectDirectory" />
                            <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                              Select QuickPlay Folder
                            </button>
                          </Form>
                          {modalState.error && <p className="mt-4 text-red-600">{modalState.error}</p>}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="mb-4 text-sm text-gray-600">Selected: {modalState.selectedPath}</p>
                      <div className="flex gap-2">
                        {actionData?.existingData ? (
                          <>
                            <Form method="post">
                              <input type="hidden" name="sourcePath" value={modalState.selectedPath} />
                              <input type="hidden" name="action" value="backup" />
                              <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                                Backup & Continue
                              </button>
                            </Form>
                            <Form method="post">
                              <input type="hidden" name="sourcePath" value={modalState.selectedPath} />
                              <input type="hidden" name="action" value="overwrite" />
                              <button className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
                                Overwrite
                              </button>
                            </Form>
                          </>
                        ) : (
                          <Form method="post">
                            <input type="hidden" name="sourcePath" value={modalState.selectedPath} />
                            <button className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                              Convert
                            </button>
                          </Form>
                        )}
                      </div>
                    </>
                  )}
                  <button
                    onClick={() => setModalState({ isOpen: false })}
                    className="mt-4 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </Modal>
          {isSplitLoaded && (
            <>
              <Split sizes={[18, 82]} className="flex overflow-hidden" style={{ height: 'calc(100vh - 7em)' }}>
                <TreeView folderData={folderData} />
                <div className="h-full overflow-auto">
                  <Outlet />
                </div>
              </Split>
              <h1 className="fixed bottom-0 left-0 m-2 text-xs font-mono underline w-full bg-white">
                Games in path: {match?.data?.romdata.length ?? 0} : User data path: {data.userDataPath}
                {process.env.NODE_ENV === 'development' && ` : Current URL: ${window.location.href}`}
              </h1>
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
