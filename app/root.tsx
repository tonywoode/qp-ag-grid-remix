import { cssBundleHref } from '@remix-run/css-bundle'
import { json, type LinksFunction, type MetaFunction } from '@remix-run/node'
import { Form, Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration, useFetcher, useLoaderData, useMatches } from '@remix-run/react' // prettier-ignore
import styles from '~/styles/styles.css'
import tailwindStyles from '~/styles/tailwind.css'
import electron from '~/electron.server'
import reactSplitStyles from '~/styles/react-split.css'
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs'
import reactTabsStyles from 'react-tabs/style/react-tabs.css'
import { Menu, MenuItem, MenuButton, SubMenu, MenuDivider } from '@szhsin/react-menu'
import reactMenuStyles from '@szhsin/react-menu/dist/index.css'
import reactMenuTransitionStyles from '@szhsin/react-menu/dist/transitions/slide.css'
import { scanFolder } from '~/make_sidebar-data.server'
import { Tree } from 'react-arborist'
import { Resizable, ResizableBox } from 'react-resizable'
import Split from 'react-split'
import { Node } from '~/components/Node'
//configure and export logging per-domain feature
import { createFeatureLogger } from '~/utils/featureLogger'
import { useState, useEffect, useRef } from 'react'
import { ScreenshotsTab } from '~/components/ScreenshotsTab'
import { loadScreenshots } from './screenshots.server'

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

const loggerConfig = [
  { feature: 'gridOperations', enabled: true },
  { feature: 'fileOperations', enabled: true },
  { feature: 'goodMergeChoosing', enabled: true }
]
export const logger = createFeatureLogger(loggerConfig)

export async function loader() {
  const folderData = await scanFolder('./data')
  const { screenshots } = await loadScreenshots()
  return json({ folderData, screenshots, userDataPath: electron.app.getPath('userData') })
  // romdata,
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
      <Tree data={folderData} openByDefault={false} width={dimensions.width} height={dimensions.height} rowHeight={42}>
        {Node}
      </Tree>
    </div>
  )
}

export function MediaPanel({ screenshots }) {
  return (
    <Tabs>
      <TabList>
        <Tab>Screenshots</Tab>
        <Tab>Game Info</Tab>
      </TabList>

      <TabPanel>
        <ScreenshotsTab screenshots={screenshots} />
      </TabPanel>
      <TabPanel>
        <h2>Good Game, son</h2>
      </TabPanel>
    </Tabs>
  )
}

export default function App() {
  const data = useLoaderData<typeof loader>()
  const folderData = data.folderData
  const screenshots = data.screenshots
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
          <div className="flex flex-row">
            {menu()}
            <Form method="post">
              <button className="box-border border-2 border-gray-500 px-2 m-3">Pick Original QP data folder</button>
            </Form>
          </div>
          {isSplitLoaded && (
            <>
              <Split sizes={[30, 70]} style={{ height: 'calc(100vh - 7em)', display: 'flex' }}>
                <TreeView folderData={folderData} />
                <div>
                  <Outlet />
                </div>
                {/* <MediaPanel screenshots={screenshots} /> */}
              </Split>
              <h1 className="absolute m-2 text-xs font-mono underline">
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
