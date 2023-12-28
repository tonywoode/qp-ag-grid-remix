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
// function CustomCellRenderer(props) {
//   return (
//     <div onClick={handleSingleClick} onDoubleClick={handleDoubleClick}>
//       {props.value}
//     </div>
//   )
// }
export default function Grid() {
  const data = useLoaderData()
  const params = useParams()
  const rowData = data.romdata
  const [selectedRow, setSelectedRow] = useState(null)
  // const [lastClickedCell, setLastClickedCell] = useState(null)
  const [alreadyClicked, setAlreadyClicked] = useState(null)
  console.log('rowData', rowData)

  //when the selected row changes, first click won't begin editing
  useEffect(() => setAlreadyClicked(false), [selectedRow])

  const [handleSingleClick, handleDoubleClick] = useClickPreventionOnDoubleClick(
    event => {
      // Pass the event to the function
      console.log('single click')
      setAlreadyClicked(true)
      event.api.startEditingCell({
        rowIndex: event.node.rowIndex,
        colKey: event.column.colId
      })
      // setLastClickedCell(event.cell)
    },
      event => {
        // Pass the event to the function
        console.log('double click')
        setAlreadyClicked(false) //after running a game, clicking in the row again won't start editing
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

  const isEditable = params => {
    console.log('node id', params.node?.id)
    console.log('selectedRow', selectedRow)
    const isEditable = selectedRow && params.node.id === selectedRow.id && alreadyClicked
    console.log('is it editable?', isEditable)
    return isEditable
  }
  // for column definitions, get ALL keys from all objects, use a set and iterate, then map to ag-grid columnDef fields
  const columnDefs = [...new Set(rowData.flatMap(Object.keys))].map(field => {
    //remove the string {GamesDir}\ from the start of all path fields TODO: should have a lit button showing gameDir subsitiution is active
    return field === 'path'
      ? { field, valueGetter: removeGamesDirPrefix, editable: isEditable }
      : { field, editable: isEditable }
  })
  function removeGamesDirPrefix(params) {
    const originalValue = params.data.path
    const modifiedValue = originalValue.replace('{gamesDir}\\', '')
    return modifiedValue
  }
  console.log(`Creating these columns from romdata: ${params.romdata}`)
  console.table(columnDefs)
  /** @type {import('ag-grid-community').GridOptions} */
  const gridOptions = {
    // components: { customCellRenderer: CustomCellRenderer },
    columnDefs: columnDefs,
    defaultColDef: { flex: 1, minWidth: 150 },
    rowSelection: 'multiple',
    singleClickEdit: true,
    enableGroupEdit: true,
    suppressClickEdit: true,
    onSelectionChanged: event => {
      setSelectedRow(event.api.getSelectedNodes()[0])
    },
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
