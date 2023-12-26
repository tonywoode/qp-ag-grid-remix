import { AgGridReact } from 'ag-grid-react'
import AgGridStyles from 'ag-grid-community/styles/ag-grid.css'
import AgThemeAlpineStyles from 'ag-grid-community/styles/ag-theme-alpine.css'
import type { CellClickedEvent } from 'ag-grid-community'
//import { romdata } from '~/../data/Console/Nintendo 64/Goodmerge 3.21 RW/romdata.json' //note destructuring
import { Outlet, useLoaderData, useParams } from '@remix-run/react'
import useClickPreventionOnDoubleClick from '~/utils/doubleClick/use-click-prevention-on-double-click'
import { loadRomdata } from '~/load_romdata.server'
import React from 'react'
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
  const [selectedRow, setSelectedRow] = React.useState(null)
  const [lastClickedCell, setLastClickedCell] = React.useState(null)
  const [firstClick, setFirstClick] = React.useState(null)
  const isDoubleClick = React.useRef(false)
  console.log('rowData', rowData)

  const [handleSingleClick, handleDoubleClick] = useClickPreventionOnDoubleClick(
    event => {
      // Pass the event to the function
      console.log('single click')
      setFirstClick(true)
      isDoubleClick.current = false // Set isDoubleClick to false on single click
      console.log(selectedRow)
      console.log(event.node)
      console.log('you single clicked in the selected row')
      event.api.startEditingCell({
        rowIndex: event.node.rowIndex,
        colKey: event.column.colId
      })
      setLastClickedCell(event.cell)
    },
      event => {
        // Pass the event to the function
        console.log('double click')
        console.log('isDoubleClick.current', isDoubleClick.current) //TODO: this is always false
        setFirstClick(false) //the nice effect of this is after running a game, clicking in the row again won't start editing
        isDoubleClick.current = true
        fetch('../runGame', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gamePath: event.data.path,
            defaultGoodMerge: event.data.defaultGoodMerge,
            emulatorName: event.data.emulatorName
          })
        })
        isDoubleClick.current = false // Reset after the double click
      }
  )

  React.useEffect(() => {
    console.log('selectedRow', selectedRow)
    setFirstClick(false)
  }, [selectedRow])

  const isEditable = params => {
    console.log('params node id', params.node?.id)
    console.log('selectedRow', selectedRow)
    console.log('is it first click?', firstClick)
    console.log('is it a double click?', isDoubleClick.current)
    console.log('is it the same row?', params.node?.id === selectedRow?.id)
    console.log(
      'so is it editable?',
      selectedRow && params.node.id === selectedRow.id && firstClick && !isDoubleClick.current
    )
    return selectedRow && params.node.id === selectedRow.id && firstClick && !isDoubleClick.current
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
