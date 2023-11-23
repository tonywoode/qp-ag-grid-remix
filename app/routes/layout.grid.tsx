import { AgGridReact } from 'ag-grid-react'
import AgGridStyles from 'ag-grid-community/styles/ag-grid.css'
import AgThemeAlpineStyles from 'ag-grid-community/styles/ag-theme-alpine.css'
import type { CellClickedEvent } from 'ag-grid-community'
import { romdata } from '~/../data/Console/Nintendo 64/Goodmerge 3.21 RW/romdata.json' //note destructuring
import { useLoaderData } from '@remix-run/react'

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
    fetch('../runGame', {
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
    romdata
  }
}

export default function Grid() {
  const data = useLoaderData()
  const rowData = data.romdata
  return (
    <div className="ag-theme-alpine" style={{ height: '100%', width: '100%' }}>
      <AgGridReact rowData={rowData} columnDefs={columnDefs} gridOptions={gridOptions}></AgGridReact>
    </div>
  )
}

export function links() {
  return [
    { rel: 'stylesheet', href: AgGridStyles },
    { rel: 'stylesheet', href: AgThemeAlpineStyles }
  ]
}
