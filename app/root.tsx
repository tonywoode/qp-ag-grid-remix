import { cssBundleHref } from '@remix-run/css-bundle'
import { json, type LinksFunction, type MetaFunction } from '@remix-run/node'
import { Form, Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData, useMatches } from '@remix-run/react' // prettier-ignore
import { useState, useEffect, useRef } from 'react'
import electron from '~/electron.server'
import reactTabsStyles from 'react-tabs/style/react-tabs.css'
import { Menu, MenuItem, MenuButton, SubMenu, MenuDivider } from '@szhsin/react-menu'
import { Tree } from 'react-arborist'
import Split from 'react-split'
// import { Resizable, ResizableBox } from 'react-resizable'

import tailwindStyles from '~/styles/tailwind.css'
import reactSplitStyles from '~/styles/react-split.css'
import styles from '~/styles/styles.css'
import reactMenuStyles from '@szhsin/react-menu/dist/index.css'
import reactMenuTransitionStyles from '@szhsin/react-menu/dist/transitions/slide.css'

import { scanFolder } from '~/makeSidebarData.server'
import { Node } from '~/components/Node'

//configure and export logging per-domain feature
//todo: user-enablable - split out to json/global flag?)
import { createFeatureLogger } from '~/utils/featureLogger'
const loggerConfig = [
  { feature: 'remixRoutes', enabled: false },
  { feature: 'gridOperations', enabled: true },
  { feature: 'fileOperations', enabled: true },
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

export const action = async () => {
  const result = await electron.dialog.showOpenDialog({
    title: 'select original QuickPlay data folder',
    properties: ['openDirectory']
  })
  return result
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
  // sets isSplitLoaded after the initial render, to avoid flash of tabs while grid's rendering
  //TODO:  this is causing delay, using react-split-grid might be better https://github.com/nathancahill/split
  // but see this after trying, which will cause console error https://github.com/nathancahill/split/issues/573
  useEffect(() => {
    setIsSplitLoaded(true)
  }, [])

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
            <Form method="post">
              <button className="box-border border-2 border-gray-500 px-2 m-3">Pick Original QP data folder</button>
            </Form>
          </div>
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
