import { json, type V2_MetaFunction } from "@remix-run/node";
import { AgGridReact } from "ag-grid-react";
import AgGridStyles from "ag-grid-community/styles/ag-grid.css";
import AgThemeAlpineStyles from "ag-grid-community/styles/ag-theme-alpine.css";
import { useLoaderData } from "@remix-run/react";

const ragCellClassRules = {
  'rag-green-outer': params => params.value === 2008,
  'rag-amber-outer': params => params.value === 2004,
  'rag-red-outer': params => params.value === 2000
}

/** @type {(import('ag-grid-community').ColDef | import('ag-grid-community').ColGroupDef )[]} */
const columnDefs = [
  { field: 'athlete' },
  {
    field: 'age',
    maxWidth: 90,
    valueParser: numberParser,
    cellClassRules: {
      'rag-green': 'x < 20',
      'rag-amber': 'x >= 20 && x < 25',
      'rag-red': 'x >= 25'
    }
  },
  { field: 'country' },
  {
    field: 'year',
    maxWidth: 90,
    valueParser: numberParser,
    cellClassRules: ragCellClassRules,
    cellRenderer: ragRenderer
  },
  { field: 'date', cellClass: 'rag-amber' },
  {
    field: 'sport',
    cellClass: cellClass
  },
  {
    field: 'gold',
    valueParser: numberParser,
    cellStyle: {
      // you can use either came case or dashes, the grid converts to whats needed
      backgroundColor: '#aaffaa' // light green
    }
  },
  {
    field: 'silver',
    valueParser: numberParser,
    // when cellStyle is a func, we can have the style change
    // dependent on the data, eg different colors for different values
    cellStyle: cellStyle
  },
  {
    field: 'bronze',
    valueParser: numberParser,
    // same as above, but demonstrating dashes in the style, grid takes care of converting to/from camel case
    cellStyle: cellStyle
  }
]

function cellStyle(params) {
  const color = numberToColor(params.value)
  return {
    backgroundColor: color
  }
}

function cellClass(params) {
  return params.value === 'Swimming' ? 'rag-green' : 'rag-amber'
}

function numberToColor(val) {
  if (val === 0) {
    return '#ffaaaa'
  } else if (val == 1) {
    return '#aaaaff'
  } else {
    return '#aaffaa'
  }
}

function ragRenderer(params) {
  return <span className="rag-element"> {params.value}</span>
}

function numberParser(params) {
  const newValue = params.newValue
  let valueAsNumber
  if (newValue === null || newValue === undefined || newValue === '') {
    valueAsNumber = null
  } else {
    valueAsNumber = parseFloat(params.newValue)
  }
  return valueAsNumber
}

/** @type {import('ag-grid-community').GridOptions} */
const gridOptions = {
  columnDefs: columnDefs,
  defaultColDef: {
    flex: 1,
    minWidth: 150,
    editable: true
  }
}
export async function loader({ request }) {
  const posts = await fetch('https://www.ag-grid.com/example-assets/olympic-winners.json').then(response =>
    response.json()
  )
  return json({ posts })
}
export default function Index() {
  const data = useLoaderData()
  const rowData = data.posts
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

