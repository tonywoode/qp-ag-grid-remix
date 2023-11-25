import { cssBundleHref } from "@remix-run/css-bundle"
import type { LinksFunction, MetaFunction } from "@remix-run/node"
import { Link, Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration } from '@remix-run/react'
import styles from '~/styles/styles.css'
import tailwindStyles from '~/styles/tailwind.css'
import { Form, useLoaderData } from '@remix-run/react'
import electron from '~/electron.server'
import reactSplitStyles from '~/styles/react-split.css'
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs'
import reactTabsStyles from 'react-tabs/style/react-tabs.css'
import { Menu, MenuItem, MenuButton, SubMenu, MenuDivider } from '@szhsin/react-menu'
import reactMenuStyles from '@szhsin/react-menu/dist/index.css'
import reactMenuTransitionStyles from '@szhsin/react-menu/dist/transitions/slide.css'
import { scanFolder } from '~/make_sidebar-data.server'
//TODO: fix this its hardcoded so not correct!
import { romdata } from '~/../data/Console/Nintendo 64/Goodmerge 3.21 RW/romdata.json' //note destructuring
import { Tree } from 'react-arborist'
import { Resizable, ResizableBox } from 'react-resizable'
import Split from 'react-split'
import { Node } from '~/Node'
export const meta: MetaFunction = () => [{ title: 'New Remix App' }]

export const links: LinksFunction = () => [
  ...(cssBundleHref ? [{ rel: 'stylesheet', href: cssBundleHref }] : []),
  { rel: 'stylesheet', href: styles },
  { rel: 'stylesheet', href: tailwindStyles },
  { rel: 'stylesheet', href: reactSplitStyles },
  { rel: 'stylesheet', href: reactTabsStyles },
  { rel: 'stylesheet', href: reactMenuStyles },
  { rel: 'stylesheet', href: reactMenuTransitionStyles }
]

//configure and export logging per-domain feature
import { createFeatureLogger } from '~/utils/featureLogger'

const loggerConfig = [
  { feature: 'gridOperations', enabled: true },
  { feature: 'fileOperations', enabled: true },
  { feature: 'goodMergeChoosing', enabled: true }
]
export const logger = createFeatureLogger(loggerConfig)

export async function loader() {
  const folderData = scanFolder('./data')
  return {
    romdata,
    userDataPath: electron.app.getPath('userData'),
    folderData
  }
}
export const action = async () => {
  const result = await electron.dialog.showOpenDialog({
    title: 'select original QuickPlay data folder',
    properties: ['openDirectory']
  })
  console.log(result)
  return result
}

export default function App() {
  const data = useLoaderData()
  console.log('data', data)
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
            <Menu
              menuButton={
                <MenuButton className="box-border border-2 border-gray-500 rounded px-2 m-3">Menu</MenuButton>
              }
            >
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
            <Form method="post">
              <button className="box-border border-2 border-gray-500 px-2 m-3">Pick Original QP data folder</button>
            </Form>
          </div>
          <Split sizes={[20, 70, 10]} style={{ height: 'calc(100vh - 7em)', display: 'flex' }}>
            <Tree
              data={data.folderData}
              openByDefault={false}
              width={360}
              height={1000}
              indent={24}
              rowHeight={42}
              padding={0}
            >
              {Node}
            </Tree>
            <div>
              <Outlet />
            </div>
            <Tabs>
              <TabList>
                <Tab>Title 1</Tab>
                <Tab>Title 2</Tab>
              </TabList>

              <TabPanel>
                <h2>Any content 1</h2>
              </TabPanel>
              <TabPanel>
                <h2>Any content 2</h2>
              </TabPanel>
            </Tabs>
          </Split>
          <h1 className="m-2 text-xs font-mono underline">
            Number of Games: {romdata.length}, User data path: {data.userDataPath}
          </h1>
        </>
        <ScrollRestoration />
        <Scripts />
        {process.env.NODE_ENV === 'development' && <LiveReload />}
      </body>
    </html>
  )
}
