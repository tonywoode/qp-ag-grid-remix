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
function CustomCellRenderer(props) {
  // const [editing, setEditing] = React.useState(false)
  // const [timer, setTimer] = React.useState(null)

  const [handleSingleClick, handleDoubleClick] = useClickPreventionOnDoubleClick(
    () => {
      console.log('single click')
      // setTimer(
      //   setTimeout(() => {
      //     setEditing(true)
      //   }, 500)
      // ) // 500ms delay before entering edit mode
    },
    () => {
      console.log('double click')
      // if (timer) {
      // clearTimeout(timer)
      // setTimer(null)
      // Handle short double-click here (launch game)
      fetch('../runGame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gamePath: props.data.path,
          defaultGoodMerge: props.data.defaultGoodMerge,
          emulatorName: props.data.emulatorName
        })
      })
    }
  )
  // React.useEffect(() => {
  //   if (editing) {
  //     props.api.startEditingCell({
  //       rowIndex: props.node.rowIndex,
  //       colKey: props.column.colId
  //     })
  //     setEditing(false)
  //   }
  // }, [editing, props.api, props.node.rowIndex, props.column.colId])

  return (
    <div onClick={handleSingleClick} onDoubleClick={handleDoubleClick}>
      {props.value}
    </div>
  )
}
export default function Grid() {
  const data = useLoaderData()
  const params = useParams()
  const rowData = data.romdata
  console.log('rowData', rowData)
  // for column definitions, get ALL keys from all objects, use a set and iterate, then map to ag-grid columnDef fields
  const columnDefs = [...new Set(rowData.flatMap(Object.keys))].map(field => {
    //remove the string {GamesDir}\ from the start of all path fields TODO: should have a lit button showing gameDir subsitiution is active
    return field === 'path'
      ? { field, valueGetter: removeGamesDirPrefix, cellRenderer: 'customCellRenderer' }
      : { field, cellRenderer: 'customCellRenderer' }
  })
  function removeGamesDirPrefix(params) {
    const originalValue = params.data.path // Assuming 'path' is the field in your data
    const modifiedValue = originalValue.replace('{gamesDir}\\', '') // Replace '{gamesDir}\\' with the actual prefix you want to remove
    return modifiedValue
  }
  console.log(`Creating these columns from romdata: ${params.romdata}`)
  console.table(columnDefs)
  /** @type {import('ag-grid-community').GridOptions} */
  const gridOptions = {
    components: { customCellRenderer: CustomCellRenderer },
    columnDefs: columnDefs,
    defaultColDef: { flex: 1, minWidth: 150 }
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
