import { AgGridReact } from 'ag-grid-react'
import AgGridStyles from 'ag-grid-community/styles/ag-grid.css'
import AgThemeAlpineStyles from 'ag-grid-community/styles/ag-theme-alpine.css'
import type { CellClickedEvent } from 'ag-grid-community'
//import { romdata } from '~/../data/Console/Nintendo 64/Goodmerge 3.21 RW/romdata.json' //note destructuring
import { Outlet, useLoaderData, useParams } from '@remix-run/react'
import useClickPreventionOnDoubleClick from '~/utils/doubleClick/use-click-prevention-on-double-click'
import { loadRomdata } from '~/load_romdata.server'
import { useState, useEffect } from 'react'
/** @type {(import('ag-grid-community').ColDef | import('ag-grid-community').ColGroupDef )[]} */

export async function loader({ params }) {
  const romdataLink = decodeURI(params.romdata)
  const romdataBlob = await loadRomdata(romdataLink)
  const romdata = romdataBlob.romdata
  return { romdata }
}

export default function Grid() {
  const data = useLoaderData()
  const params = useParams()
  const rowData = data.romdata
  const [clickedCell, setClickedCell] = useState(null)
  console.log('rowData', rowData)
  const runGame = gameData => {
    fetch('../runGame', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gameData)
    })
  }
  const [handleSingleClick, handleDoubleClick] = useClickPreventionOnDoubleClick(
    event => {
      const rowIndex = event.node.rowIndex
      const colKey = event.column.colId
      console.log('single click')
      setClickedCell({ rowIndex, colKey })
      event.api.startEditingCell({ rowIndex, colKey })
    },
    event => {
      console.log('double click')
      fetch('../runGame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gamePath: event.data.path,
          defaultGoodMerge: event.data.defaultGoodMerge,
          emulatorName: event.data.emulatorName
        })
      })
    }
  )

  const isEditable = ({ node: { rowIndex }, column: { colId } }) =>
    clickedCell && rowIndex === clickedCell.rowIndex && colId === clickedCell.colKey

  // for column definitions, get ALL keys from all objects, use a set and iterate, then map to ag-grid columnDef fields
  const columnDefs = [...new Set(rowData.flatMap(Object.keys))].map(field => ({
    //remove the string {GamesDir}\ from the start of all path fields TODO: should have a lit button showing gameDir subsitiution is active
    field,
    editable: isEditable,
    valueGetter: field === 'path' ? removeGamesDirPrefix : undefined
  }))

  function removeGamesDirPrefix({ data: { path } }) {
    return path.replace('{gamesDir}\\', '')
  }

  console.log(`Creating these columns from romdata: ${params.romdata}`)
  console.table(columnDefs)
  /** @type {import('ag-grid-community').GridOptions} */
  const gridOptions = {
    columnDefs: columnDefs,
    defaultColDef: { flex: 1, minWidth: 150 },
    rowSelection: 'multiple',
    singleClickEdit: true,
    enableGroupEdit: true,
    suppressClickEdit: true,
    onCellClicked: event => handleSingleClick(event),
    onCellDoubleClicked: event => handleDoubleClick(event)
  }
  return (
    <>
      <div className="ag-theme-alpine" style={{ height: '100%', width: '100%' }}>
        <AgGridReact rowData={rowData} columnDefs={columnDefs} gridOptions={gridOptions}></AgGridReact>
      </div>
      <Outlet />
    </>
  )
}

export function links() {
  return [
    { rel: 'stylesheet', href: AgGridStyles },
    { rel: 'stylesheet', href: AgThemeAlpineStyles }
  ]
}
