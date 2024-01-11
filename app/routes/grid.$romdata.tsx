import { AgGridReact } from 'ag-grid-react'
import AgGridStyles from 'ag-grid-community/styles/ag-grid.css'
import AgThemeAlpineStyles from 'ag-grid-community/styles/ag-theme-alpine.css'
import type { CellClickedEvent, GridOptions, ColDef, ColGroupDef } from 'ag-grid-community'
//import { romdata } from '~/../data/Console/Nintendo 64/Goodmerge 3.21 RW/romdata.json' //note destructuring
import { Outlet, useLoaderData, useParams, useNavigate } from '@remix-run/react'
import useClickPreventionOnDoubleClick from '~/utils/doubleClick/use-click-prevention-on-double-click'
import { loadRomdata } from '~/load_romdata.server'
import { useState } from 'react'
import Split from 'react-split'
export async function loader({ params }) {
  const romdataLink = decodeURI(params.romdata)
  const romdataBlob = await loadRomdata(romdataLink)
  return { romdata: romdataBlob.romdata }
}

export const runGame = gameData => {
  fetch('/runGame', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(gameData)
  })
}

export default function Grid() {
  const { romdata } = useLoaderData()
  const params = useParams()
  const navigate = useNavigate()
  const [clickedCell, setClickedCell] = useState(null)
  const [clickedYet, setClickedYet] = useState(false)
  const [handleSingleClick, handleDoubleClick] = useClickPreventionOnDoubleClick(
    e => {
      console.log('single click')
      console.log(e.data)
      const romname = e.data.name
      if (clickedYet) {
        navigate(`${encodeURI(romname)}`)
        setClickedYet(true)
      }
      const { node: { rowIndex }, column: { colId }, api }: CellClickedEvent = e // prettier-ignore
      setClickedCell({ rowIndex, colKey: colId })
      api.startEditingCell({ rowIndex, colKey: colId })
    },
    e => {
      console.log('double click')
      const { data: { path, defaultGoodMerge, emulatorName } }: CellClickedEvent = e //prettier-ignore
      runGame({ gamePath: path, defaultGoodMerge, emulatorName })
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

  //remove the string {GamesDir}\ from the start of all path fields TODO: should have a lit button showing gameDir substitution is active
  function removeGamesDirPrefix({ data: { path } }) {
    return path.replace('{gamesDir}\\', '')
  }

  console.log(`Creating these columns from romdata: ${params.romdata}`)
  console.table(columnDefs)

  const gridOptions: GridOptions = {
    columnDefs,
    defaultColDef: { flex: 1, minWidth: 150 },
    rowSelection: 'multiple',
    singleClickEdit: true,
    enableGroupEdit: true,
    suppressClickEdit: true,
    onCellClicked: handleSingleClick,
    onCellDoubleClicked: handleDoubleClick
  }
  return (
    <Split sizes={[50, 50]} style={{ height: 'calc(100vh - 7em)', display: 'flex' }}>
      {[
        <div className="ag-theme-alpine" style={{ height: '100%', width: '100%' }}>
          <AgGridReact rowData={romdata} columnDefs={columnDefs} gridOptions={gridOptions} />
        </div>,
        <div>
          <Outlet />
        </div>
      ]}
    </Split>
  )
}

export function links() {
  return [
    { rel: 'stylesheet', href: AgGridStyles },
    { rel: 'stylesheet', href: AgThemeAlpineStyles }
  ]
}
