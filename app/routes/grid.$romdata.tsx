import { AgGridReact } from 'ag-grid-react'
import AgGridStyles from 'ag-grid-community/styles/ag-grid.css'
import AgThemeAlpineStyles from 'ag-grid-community/styles/ag-theme-alpine.css'
import type { CellKeyDownEvent, CellClickedEvent, GridOptions, ColDef, ColGroupDef } from 'ag-grid-community'
import { Outlet, useLoaderData, useParams, useNavigate, useFetcher } from '@remix-run/react'
import type { LoaderFunctionArgs } from '@remix-run/node'
import { useState } from 'react'
import Split from 'react-split'
import useClickPreventionOnDoubleClick from '~/utils/doubleClick/use-click-prevention-on-double-click'
import { loadRomdata } from '~/loadRomdata.server' //import { romdata } from '~/../data/Console/Nintendo 64/Goodmerge 3.21 RW/romdata.json' //note destructuring
import { encodeString, decodeString } from '~/utils/safeUrl'
import { loadMameIconBase64 } from '~/loadMameIcons.server'
import { loadIconBase64 } from '~/loadImages.server'

export async function loader({ params }: LoaderFunctionArgs) {
  const romdataLink = decodeString(params.romdata)
  const romdataBlob = await loadRomdata(romdataLink)
  const romdata = romdataBlob.romdata
  const defaultIconBase64 = await loadIconBase64('rom.ico') //default icon

  // Preload icons and tooltips
  const romdataWithIcons = await Promise.all(
    romdata.map(async item => {
      const iconBase64 = await loadMameIconBase64(item.mameName, item.parentName)
      // const tooltip = `${item.mameName || ''} ${item.parentName || ''}`.trim()
      return { ...item, iconBase64: iconBase64 || defaultIconBase64 }
    })
  )

  return { romdata: romdataWithIcons }
}

export default function Grid() {
  let { romdata } = useLoaderData<typeof loader>()
  const params = useParams()
  const navigate = useNavigate()
  const fetcher = useFetcher<typeof runGameAction>()
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
  const runGameWithRomdataFromEvent = (e: CellClickedEvent) => {
    const {
      data: { path, defaultGoodMerge, emulatorName }
    } = e
    fetcher.submit(
      { gamePath: path, defaultGoodMerge, emulatorName },
      { action: '/runGame', method: 'post', encType: 'application/json' }
    )
  }
  const isEditable = ({ node: { rowIndex }, column: { colId } }) =>
    clickedCell && rowIndex === clickedCell.rowIndex && colId === clickedCell.colKey

  const iconColumn = {
    headerName: 'Icon',
    field: 'icon',
    width: 50,
    suppressSizeToFit: true,
    cellRenderer: ({ data }) => (
      <div className="w-6 h-6" title={`${data.mameName || ''}\n${data.parentName || ''}`.trim()}>
        <img src={data.iconBase64} alt="ROM Icon" className="w-6 h-6" />
      </div>
    )
  }

  // get ALL keys from all objects, use a set and iterate, then map to ag-grid columnDef fields
  const columnDefs: (ColDef | ColGroupDef)[] = [
    iconColumn,
    ...[...new Set(romdata.flatMap(Object.keys))]
      .filter(field => field !== 'iconBase64') // Exclude 'iconBase64'
      .map(field => ({
        field,
        editable: isEditable,
        valueGetter: field === 'path' ? removeGamesDirPrefix : undefined
      }))
  ]

  console.log(`Creating these columns from romdata: ${params.romdata}`)
  console.table(columnDefs)
  const gridOptions: GridOptions = {
    columnDefs,
    defaultColDef: { flex: 1, minWidth: 150, resizable: true, sortable: true, filter: true, floatingFilter: true },
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
        //prevent the 'i' key from entering field edit whilst trying to type a filter (no idea why it does this)
      } else if (e.event.key === 'i') {
        e.event.preventDefault()
      }
    },
    onRowSelected: async function (event) {
      if (event.node.selected) {
        console.log(event)
        console.log('row selected')
        const eventData = event.data
        const romname = event.data.name
        const system = eventData.system
        //include mamenames as locacation state if they exist
        navigate(`${encodeString(system)}/${encodeString(romname)}`, {
          state: {
            ...(event.data.mameName != null && { mameName: event.data.mameName }),
            ...(event.data.parentName != null && { parentName: event.data.parentName })
          }
        })
      }
    }
  }
  return (
    <Split sizes={[70, 30]} style={{ height: 'calc(100vh - 7em)', display: 'flex' }}>
      {[
        <div key="grid" className="ag-theme-alpine" style={{ height: '100%', width: '100%' }}>
          <AgGridReact rowData={romdata} columnDefs={columnDefs} gridOptions={gridOptions} />
        </div>,
        <div key="mediaPanel" className="h-full overflow-auto">
          {<Outlet />}
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
