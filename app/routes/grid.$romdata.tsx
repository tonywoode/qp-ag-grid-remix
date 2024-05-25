import { AgGridReact } from 'ag-grid-react'
import AgGridStyles from 'ag-grid-community/styles/ag-grid.css'
import AgThemeAlpineStyles from 'ag-grid-community/styles/ag-theme-alpine.css'
import type { CellKeyDownEvent, CellClickedEvent, GridOptions, ColDef, ColGroupDef } from 'ag-grid-community'
//import { romdata } from '~/../data/Console/Nintendo 64/Goodmerge 3.21 RW/romdata.json' //note destructuring
import { Outlet, useLoaderData, useParams, useNavigate } from '@remix-run/react'
import useClickPreventionOnDoubleClick from '~/utils/doubleClick/use-click-prevention-on-double-click'
import { loadRomdata } from '~/load_romdata.server'
import { useEffect, useState } from 'react'
import Split from 'react-split'
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs'
import { ScreenshotsTab } from '~/components/ScreenshotsTab'
import { loadScreenshots } from '~/screenshots.server'
export async function loader({ params }) {
  const romdataLink = decodeURI(params.romdata)
  // let { screenshots } = await loadScreenshots()
  const romdataBlob = await loadRomdata(romdataLink)
  return { romdata: romdataBlob.romdata }
}

const runGameWithRomdataFromEvent = (e: CellClickedEvent) => {
  const {
    data: { path, defaultGoodMerge, emulatorName }
  } = e
  runGame({ gamePath: path, defaultGoodMerge, emulatorName })
}

export const runGame = gameData => {
  fetch('/runGame', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(gameData)
  })
}

export const getScreenshots = screenshots => {
  return fetch('/getScreenshots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(screenshots)
  })
}
export function MediaPanel({ screenshots }) {
  screenshots = screenshots ? screenshots : []
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
export default function Grid() {
  const [isRomSelected, setIsRomSelected] = useState(false)
  const [base64Image, setBase64Image] = useState(null)
  const [screenshotUrl, setScreenshotUrl] = useState()
  let { romdata } = useLoaderData()
  //when we switch to a new romdata, reset the state
  useEffect(() => {
    // Reset isRomSelected and base64Image when romdata changes
    setIsRomSelected(false)
    setBase64Image(null)
  }, [romdata])
  const params = useParams()
  const navigate = useNavigate()
  const [clickedCell, setClickedCell] = useState(null)
  const [handleSingleClick, handleDoubleClick] = useClickPreventionOnDoubleClick(
    async (e: CellClickedEvent) => {
      console.log('single click')
      console.log(e.data)
      const { node: { rowIndex }, column: { colId }, api }: CellClickedEvent = e // prettier-ignore
      setClickedCell({ rowIndex, colKey: colId })
      api.startEditingCell({ rowIndex, colKey: colId })
    },
    (e: CellClickedEvent) => {
      console.log('double click')
      runGameWithRomdataFromEvent(e)
    }
  )

  const isEditable = ({ node: { rowIndex }, column: { colId } }) =>
    clickedCell && rowIndex === clickedCell.rowIndex && colId === clickedCell.colKey

  // get ALL keys from all objects, use a set and iterate, then map to ag-grid columnDef fields
  const columnDefs: (ColDef | ColGroupDef)[] = [...new Set(romdata.flatMap(Object.keys))].map(field => ({
    field,
    editable: isEditable,
    valueGetter: field === 'path' ? removeGamesDirPrefix : undefined
  }))

  console.log(`Creating these columns from romdata: ${params.romdata}`)
  console.table(columnDefs)
  const gridOptions: GridOptions = {
    columnDefs,
    defaultColDef: { flex: 1, minWidth: 150, resizable: true, sortable: true },
    rowSelection: 'multiple',
    singleClickEdit: true,
    enableGroupEdit: true,
    suppressClickEdit: true,
    onCellClicked: handleSingleClick,
    onCellDoubleClicked: handleDoubleClick,
    onCellKeyDown: function (e: CellKeyDownEvent) {
      console.log('event.key is ' + e.event.key)
      //don't multiple select when arrow keys used for navigation
      if (e.event.key === 'ArrowUp' || e.event.key === 'ArrowDown') {
        const focusedNode = e.api.getDisplayedRowAtIndex(e.api.getFocusedCell().rowIndex)
        e.api.forEachNode(node => {
          if (node !== focusedNode) {
            node.setSelected(false)
          }
        })
        focusedNode.setSelected(true)
      } else if (e.event.key === 'Enter') {
        runGameWithRomdataFromEvent(e)
      }
    },
    onRowSelected: async function (event) {
      if (event.node.selected) {
        console.log(event)
        console.log('row selected')
        setIsRomSelected(true)
        const romname = event.data.name
        const romnameNoParens = romname.replace(/\(.*\)/g, '').trim()
        const response = await getScreenshots(romnameNoParens)
        const data = await response.json()
        setBase64Image(data.screenshots)
        setScreenshotUrl(romname)
      }
    }
  }
  return (
    <Split sizes={[70, 30]} style={{ height: 'calc(100vh - 7em)', display: 'flex' }}>
      {[
        <div key="grid" className="ag-theme-alpine" style={{ height: '100%', width: '100%' }}>
          <AgGridReact rowData={romdata} columnDefs={columnDefs} gridOptions={gridOptions} />
        </div>,
        <div key="mediaPanel">
          {isRomSelected && <MediaPanel screenshots={base64Image ? [base64Image] : []}>{screenshotUrl}</MediaPanel>}
          {/* <div>{screenshotUrl}</div> */}
        </div>
      ]}
    </Split>
  )
}

//remove the string {GamesDir}\ from the start of all path fields TODO: should have a lit button showing gameDir substitution is active
function removeGamesDirPrefix({ data: { path } }) {
  return path.replace('{gamesDir}\\', '')
}

export function links() {
  return [
    { rel: 'stylesheet', href: AgGridStyles },
    { rel: 'stylesheet', href: AgThemeAlpineStyles }
  ]
}
