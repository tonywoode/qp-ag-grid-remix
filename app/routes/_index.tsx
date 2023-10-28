import { Form, useLoaderData } from '@remix-run/react'
import electron from '~/electron.server'
import { json, type V2_MetaFunction } from '@remix-run/node'
import { AgGridReact } from 'ag-grid-react'
import reactSplitStyles from '~/styles/react-split.css'
import AgGridStyles from 'ag-grid-community/styles/ag-grid.css'
import AgThemeAlpineStyles from 'ag-grid-community/styles/ag-theme-alpine.css'
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs'
import reactTabsStyles from 'react-tabs/style/react-tabs.css'
import { Menu, MenuItem, MenuButton, SubMenu, MenuDivider } from '@szhsin/react-menu'
import reactMenuStyles from '@szhsin/react-menu/dist/index.css'
import reactMenuTransitionStyles from '@szhsin/react-menu/dist/transitions/slide.css'
import { romdata } from '~/../data/Console/Nintendo SNES/Goodmerge 2.04 Tony/romdata.json' //note destructuring
import { CellClickedEvent } from 'ag-grid-community'
import { Tree } from 'react-arborist'
import { Resizable, ResizableBox } from 'react-resizable'
import Split from 'react-split'

//configure and export logging per-domain feature
import { createFeatureLogger } from '~/utils/featureLogger'

const loggerConfig = [
  { feature: 'gridOperations', enabled: true },
  { feature: 'fileOperations', enabled: true },
  { feature: 'goodMergeChoosing', enabled: true }
]
export const logger = createFeatureLogger(loggerConfig)

/** @type {(import('ag-grid-community').ColDef | import('ag-grid-community').ColGroupDef )[]} */
// for column definitions, get ALL keys from all objects, use a set and iterate, then map to ag-grid columnDef fields
const columnDefs = [...new Set(romdata.flatMap(Object.keys))].map(field => {
  //remove the string {GamesDir}\ from the start of all path fields TODO: should have a lit button showing gameDir subsitiution is active
  if (field === 'path') {
    return {
      field,
      valueGetter: removeGamesDirPrefix
    }
  }
  return { field }
})

function removeGamesDirPrefix(params) {
  const originalValue = params.data.path // Assuming 'path' is the field in your data
  const modifiedValue = originalValue.replace('{gamesDir}\\', '') // Replace '{gamesDir}\\' with the actual prefix you want to remove
  return modifiedValue
}
console.log('Creating these columns from romdata:')
console.table(columnDefs)
/** @type {import('ag-grid-community').GridOptions} */
const gridOptions = {
  onCellClicked: (event: CellClickedEvent) => {
    console.log(event.data)
    fetch('runGame', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        gamePath: event.data.path,
        defaultGoodMerge: event.data.defaultGoodMerge,
        emulatorName: event.data.emulatorName
      })
    })
  },
  columnDefs: columnDefs,
  defaultColDef: {
    flex: 1,
    minWidth: 150,
    editable: true
  }
}

export async function loader() {
  return {
    romdata,
    userDataPath: electron.app.getPath('userData')
  }
}

export const action = async () => {
  const result = await electron.dialog.showOpenDialog({
    title: 'select origingal QuickPlay data folder',
    properties: ['openDirectory']
  })
  console.log(result)
  return result
}

const treeData = [
  {
    id: '1',
    name: 'public',
    children: [{ id: 'c1-1', name: 'index.html' }]
  },
  {
    id: '2',
    name: 'src',
    children: [
      { id: 'c2-1', name: 'App.js' },
      { id: 'c2-2', name: 'index.js' },
      { id: 'c2-3', name: 'styles.css' }
    ]
  },
  { id: '3', name: 'package.json' },
  { id: '4', name: 'README.md' }
]

export default function Index() {
  const data = useLoaderData()
  const rowData = data.romdata
  return (
    <>
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
      <Form method="post">
        <button className="box-border border-2 border-gray-500 px-2 m-3">Pick Original QP data folder</button>
      </Form>
      <Split sizes={[10, 70, 20]} style={{ height: 'calc(100vh - 7em)', display: 'flex' }}>
        <Tree initialData={treeData} />
        <div className="ag-theme-alpine">
          <AgGridReact rowData={rowData} columnDefs={columnDefs} gridOptions={gridOptions}></AgGridReact>
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
  )
}

export function links() {
  return [
    { rel: 'stylesheet', href: AgGridStyles },
    { rel: 'stylesheet', href: AgThemeAlpineStyles },
    { rel: 'stylesheet', href: reactSplitStyles },
    { rel: 'stylesheet', href: reactTabsStyles },
    { rel: 'stylesheet', href: reactMenuStyles },
    { rel: 'stylesheet', href: reactMenuTransitionStyles }
  ]
}
