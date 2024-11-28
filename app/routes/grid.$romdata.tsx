import { AgGridReact } from 'ag-grid-react'
import AgGridStyles from 'ag-grid-community/styles/ag-grid.css'
import AgThemeAlpineStyles from 'ag-grid-community/styles/ag-theme-alpine.css'
import type { CellKeyDownEvent, CellClickedEvent, GridOptions, ColDef, ColGroupDef } from 'ag-grid-community'
import { Outlet, useLoaderData, useParams, useNavigate, useFetcher } from '@remix-run/react'
import type { LoaderFunctionArgs } from '@remix-run/node'
import { useEffect, useState } from 'react'
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
  const defaultIconBase64 = await loadIconBase64('rom.ico')

  const romdataWithIcons = await Promise.all(
    romdata.map(async (item, index) => {
      const iconBase64 = await loadMameIconBase64(item.mameName, item.parentName)
      return {
        ...item,
        id: index, //we save the index to give each item a unique id, to try and keep parents and children together
        originalIndex: index,
        iconBase64: iconBase64 || defaultIconBase64
      }
    })
  )
  return { romdata: romdataWithIcons }
}

export default function Grid() {
  const { romdata } = useLoaderData<typeof loader>()
  const [rowdata, setRowdata] = useState(romdata) //another option would have been to use grid-api rather than react state
  const params = useParams()
  const navigate = useNavigate()
  const fetcher = useFetcher<typeof runGameAction>()
  const [clickedCell, setClickedCell] = useState<{ rowIndex: number; colKey: string } | null>(null)
  type BaseContextMenu = { x: number, y: number }
  type RomContextMenu = BaseContextMenu & { type: 'rom', e: CellClickedEvent }
  type ZipContextMenu = BaseContextMenu & { type: 'zip', fileInZip: string, parentNode: object }
  type ContextMenu = RomContextMenu | ZipContextMenu
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  useEffect(() => { //when right-click grid menus are opened, close them when clicking anywhere else in the app
    const handleClickOutside = () => setContextMenu(null)
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  useEffect(() => { //TODO: why is this required, since the loader should rerun when changing systems
    setRowdata(romdata)
  }, [romdata])

  const [handleSingleClick, handleDoubleClick] = useClickPreventionOnDoubleClick(
    async (e: CellClickedEvent) => {
      console.log('single click')
      console.log(e.data)
      const { node, column, api }: CellClickedEvent = e // prettier-ignore
      const rowIndex = node.rowIndex ?? 0
      const colId = column.getColId()
      setClickedCell({ rowIndex, colKey: colId })
      api.startEditingCell({ rowIndex, colKey: colId })
    },
    (e: CellClickedEvent) => {
      console.log('double click')
      runGameWithRomdataFromEvent(e)
    }
  )

  const runGameWithRomdataFromEvent = (e: CellClickedEvent) => {
    console.log('Running game with data:', e.node.data) // Debug log
    const {
      data: { path, defaultGoodMerge, emulatorName }
    } = e.node // Use node data directly instead of looking up by index
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
    minWidth: 65,
    autoHeight: true,
    filter: false,
    suppressSizeToFit: true,
    cellRenderer: ({ data }) => (
      <div
        className="w-full h-full flex items-center justify-center"
        title={`${data.mameName || ''}\n${data.parentName || ''}`.trim()}
      >
        <img src={data.iconBase64} alt="ROM Icon" className="max-w-full max-h-full" />
      </div>
    )
  }
  //TODO: what if either an individual entry, or the whole list, don't link to a compressed file?
  const toggleExpandedRow = async (rowId: string, api: any, node: any) => {
    const expandedNode = api.getRowNode(`${rowId}-expanded`)
    if (expandedNode) {
      // Find current position of expanded row
      let currentIndex = -1
      api.forEachNode((node, index) => {
        if (node.data?.id === `${rowId}-expanded`) currentIndex = index 
      })
      //collapse row
      if (currentIndex !== -1) {
        rowdata.splice(currentIndex, 1)
        setRowdata([...rowdata])
      }
    } else {
      //todo see prev commits for a try catch need to handle lookup failure
      const response = await fetch(`/listZip?path=${encodeURIComponent(node.data.path)}`)
      const files = await response.json()
      // Find current position of parent
      let parentIndex = -1
      api.forEachNode((n, index) => {
        if (n.data?.id === rowId) parentIndex = index 
      })
      const expandedRowNode = {
        id: `${rowId}-expanded`,
        fullWidth: true,
        parent: node,
        parentId: rowId,
        parentData: node.data, //fraid so, how else can we satisfy comparison
        files: files,
        rowHeight: (node.rowHeight / 2) * (files.length + 1)
      }
      // Insert after current parent position
      if (parentIndex !== -1) {
        rowdata.splice(parentIndex + 1, 0, expandedRowNode)
        setRowdata([...rowdata])
      }
    }
  }

  const zipColumn = {
    headerName: 'Zip',
    field: 'zip',
    minWidth: 50,
    filter: false,
    suppressSizeToFit: true,
    cellRenderer: ({ data, api, node }) => {
      const isExpanded = Boolean(api.getRowNode(`${data.id}-expanded`))
      return (
        <div className="w-full h-full flex items-center justify-center">
          <button
            className="text-blue-500 hover:text-blue-700"
            onClick={async () => toggleExpandedRow(data.id, api, node)}
          >
            {isExpanded ? '−' : '+'}
          </button>
        </div>
      )
    }
  }

  //The zip contents menu accessible by clicking the + button in the zip column
  const fullWidthCellRenderer = params => {
    const parentNode = params.data.parent
    const files = params.data.files
    return (
      <div className="p-4 bg-gray-50">
        <div className="max-h-48 overflow-y-auto">
          {files.map((file, index) => (
            <div
              key={index}
              className="py-1 hover:bg-gray-100"
              onClick={() => console.log('you clicked on ' + file)}
              onContextMenu={(e: React.MouseEvent) => {
                e.preventDefault()
                setContextMenu({ 
                  type: 'zip',
                  x: e.clientX, 
                  y: e.clientY, 
                  fileInZip: file, 
                  parentNode: parentNode 
                })}}
            >
              {file}
            </div>
          ))}
        </div>
      </div>
    )
  }

  //multiple select is not desired until its desired, however how do we determine when a multiple selection is intentional
  function preventMultipleSelect(api) {
    const focusedNode = api.getDisplayedRowAtIndex(api.getFocusedCell().rowIndex)
    api.forEachNode(node => {
      if (node !== focusedNode) node.setSelected(false)
    })
    focusedNode.setSelected(true)
  }

  //more ag-grid community workarounds: expanded rows are going to lose their order if we sort
  const createComparator = (field: string) => {
    return (valueA: any, valueB: any, nodeA: any, nodeB: any, isDescending: boolean) => {
      const nodeAId = nodeA.data?.id 
      const nodeBId = nodeB.data?.id 
      const parentAId = nodeA.data?.parentId
      const parentBId = nodeB.data?.parentId
      const isNodeAFullWidth = nodeA.data?.fullWidth     
      const isNodeBFullWidth = nodeB.data?.fullWidth     
      // If one is a full-width row, compare based on parent
      if (isNodeAFullWidth || isNodeBFullWidth) {
        // In descending order, check if this is an expanded row and its parent is below it
        if (isDescending) {
          // If nodeA is expanded row, check if nodeB is its parent
          if (isNodeAFullWidth && nodeBId === parentAId) {
            return -1  // Force expanded row after parent
          }
        }
        if (parentAId === nodeBId) return 1
        if (parentBId === nodeAId) return -1
        //use parents value for field compare if its a fullWidth (we saved parent data in expanded row, other node isn't necessarily its parent)
        if (isNodeAFullWidth) valueA = nodeA.data.parentData[field]
        if (isNodeBFullWidth) valueB = nodeB.data.parentData[field]
      }
      if (valueA === null || valueA === undefined) return 1
      if (valueB === null || valueB === undefined) return -1
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return valueA.localeCompare(valueB)
      }
      if (valueA < valueB) return -1
      if (valueA > valueB) return 1
      return 0
    }
  }

  // get ALL keys from all objects, use a set and iterate, then map to ag-grid columnDef fields
  const columnDefs: (ColDef | ColGroupDef)[] = [
    zipColumn,
    iconColumn,
    ...[...new Set(romdata.flatMap(Object.keys))]
      .filter(field => field !== 'iconBase64') // Exclude 'iconBase64'
      .map(field => ({
        field,
        editable: isEditable,
        valueGetter: field === 'path' ? removeGamesDirPrefix : undefined,
        comparator: createComparator(field)
        // fullWidth: false
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
    getRowHeight: (params): number | undefined | null => params.data.rowHeight, 
    isFullWidthRow: params => params.rowNode.data?.fullWidth === true,
    fullWidthCellRenderer,
    onCellClicked: handleSingleClick,
    onCellDoubleClicked: handleDoubleClick,
    onCellKeyDown: (e: CellKeyDownEvent) => {
      const keyPressed = e.event.key
      console.log('event.key is ' + keyPressed)
      //don't multiple select when arrow keys used for navigation
      if (keyPressed === 'ArrowUp' || keyPressed === 'ArrowDown') preventMultipleSelect(e.api) 
      else if (keyPressed === 'Enter') runGameWithRomdataFromEvent(e)
        //prevent the 'i' key from entering field edit whilst trying to type a filter (no idea why it does this)
      else if (keyPressed === 'i') e.event.preventDefault()
    },
    onRowSelected: async function (event) {
      if (event.node.selected) {
        console.log(event)
        console.log('row selected')
        const eventData = event.data
        const romname = event.data.name
        const system = eventData.system
        //include mamenames as location state if they exist
        navigate(`${encodeString(system)}/${encodeString(romname)}`, {
          state: {
            ...(event.data.mameName != null && { mameName: event.data.mameName }),
            ...(event.data.parentName != null && { parentName: event.data.parentName })
          }
        })
      }
    },
    //this event carries the ROW context menu firing, compare with onContextMenu in the full-width cell renderer
    onCellContextMenu: (e: CellClickedEvent) => {
      e.event?.preventDefault()
      setContextMenu({
        type: 'rom',
        x: e.event?.clientX,
        y: e.event?.clientY,
        e
      })
      preventMultipleSelect(e.api)
    },
    getRowId: params =>
      params.data.fullWidth ? params.data.parentId + '-expanded' : params.data.id || params.data.name,
    animateRows: true //needs getRowId to be set see https://www.youtube.com/watch?v=_V5qFr62uhY
    // onSortChanged: updateRowData,
    // onFilterChanged: updateRowData
  }

  return (
    <>
      <Split sizes={[70, 30]} style={{ height: 'calc(100vh - 7em)', display: 'flex' }}>
        {[
          <div key="grid" className="ag-theme-alpine" style={{ height: '100%', width: '100%' }}>
            <AgGridReact
              rowData={rowdata}
              columnDefs={columnDefs}
              gridOptions={gridOptions}
            />
          </div>,
          <div key="mediaPanel" className="h-full overflow-auto">
            <Outlet key="outlet" />
          </div>
        ]}
      </Split>
      {contextMenu && (
        <div
          className="absolute bg-white shadow-md border rounded"
          style={{
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 1000,
            minWidth: '150px'
          }}
          onClick={() => setContextMenu(null)} // Close menu on click
        >
          <ul>
            {contextMenu.type === 'zip' ? (
              <li
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                onClick={() => {
                  console.log('Set as Default')
                  console.log(contextMenu)
                  console.log(clickedCell)
                  const currentDefaultGoodMerge = contextMenu.parentNode.data?.defaultGoodMerge
                  console.log('current goodmerge:', currentDefaultGoodMerge || 'none')
                  // }
                }}
              >
                Set as Default
              </li>
            ) : ( //contextMenu.type === 'rom'
              <>
                <li
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => {
                    console.log('Run Rom')
                    console.log(contextMenu.e.data)
                    runGameWithRomdataFromEvent(contextMenu.e)
                  }}
                >
                  Run Rom
                </li>
                <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer" onClick={() => console.log('Action 2')}>
                  Action 2
                </li>
              </>
            )}
          </ul>
        </div>
      )}
    </>
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
