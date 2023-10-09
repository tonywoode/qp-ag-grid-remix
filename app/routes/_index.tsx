import { json, type V2_MetaFunction } from "@remix-run/node";
import { AgGridReact } from "ag-grid-react";
import AgGridStyles from "ag-grid-community/styles/ag-grid.css";
import AgThemeAlpineStyles from "ag-grid-community/styles/ag-theme-alpine.css";
import { useLoaderData } from "@remix-run/react";
import { romdata } from '~/../outputs/romdata.json' //note destructuring
import { CellClickedEvent } from 'ag-grid-community'

//configure and export logging per-domain feature
import { createFeatureLogger } from '~/utils/featureLogger'
const loggerConfig = [{ feature: 'goodMergeChoosing', enabled: true }]
export const logger = createFeatureLogger(loggerConfig)

/** @type {(import('ag-grid-community').ColDef | import('ag-grid-community').ColGroupDef )[]} */
// for column definitions, get ALL keys from all objects, use a set and iterate, then map to ag-grid columnDef fields
const columnDefs = [...new Set(romdata.flatMap(Object.keys))].map(field => ({ field }))
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
      body: JSON.stringify({ gamePath: event.data.path, defaultGoodMerge: event.data.defaultGoodMerge })
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
  return json({ romdata })
}


export default function Index() {
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
    { rel: "stylesheet", href: AgGridStyles },
    { rel: "stylesheet", href: AgThemeAlpineStyles },
  ];
}

