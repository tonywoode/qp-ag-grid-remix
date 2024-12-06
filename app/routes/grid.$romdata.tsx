import { AgGridReact } from 'ag-grid-react'
import AgGridStyles from 'ag-grid-community/styles/ag-grid.css'
import AgThemeAlpineStyles from 'ag-grid-community/styles/ag-theme-alpine.css'
import type { CellKeyDownEvent, CellClickedEvent, GridOptions, ColDef, ColGroupDef, EditableCallbackParams } from 'ag-grid-community'
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
  console.log('the loader reran')
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
        iconBase64: iconBase64 || defaultIconBase64,
        fullWidth: false 
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
  type BaseContextMenu = { x: number; y: number }
  type RomContextMenu = BaseContextMenu & {
    type: 'rom'
    path: string
    defaultGoodMerge: string
    emulatorName: string
  }
  type ZipContextMenu = BaseContextMenu & {
    type: 'zip'
    fileInZip: string
    parentNode: object
  }
  type ContextMenu = RomContextMenu | ZipContextMenu

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  useEffect(() => {
    //when right-click grid menus are opened, close them when clicking anywhere else in the app
    const handleClickOutside = () => setContextMenu(null)
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  useEffect(() => {
    //TODO: why is this required, since the loader should rerun when changing systems
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
      const { path, defaultGoodMerge, emulatorName } = e.node.data
      runGame(path, defaultGoodMerge, emulatorName)
    }
  )

  const runGame = (gamePath: string, defaultGoodMerge: string, emulatorName: string) => {
    fetcher.submit(
      { gamePath, defaultGoodMerge, emulatorName },
      { action: '/runGame', method: 'post', encType: 'application/json' }
    )
  }

  const isEditable = (params: EditableCallbackParams) =>
    !!(clickedCell && params.node.rowIndex === clickedCell.rowIndex && params.column.getColId() === clickedCell.colKey)

  const iconColumn = {
    headerName: 'Icon',
    field: 'icon',
    minWidth: 65,
    // autoHeight: true, //in combination with (style) rowHeight, makes the grid all wobbly on scroll
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
      console.log('there are ' + files.length + ' files in the zip')
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
        files: files
        // rowHeight: (node.rowHeight / 2) * (files.length + 1)
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
    const [handleFileSingleClick, handleFileDoubleClick] = useClickPreventionOnDoubleClick(
      (file: string) => {
        console.log('clicked on file in zip', file)
      },
      (file: string) => {
        console.log('double clicked on file in zip', file)
      }
    )
    return (
      <div className={`py-1 pl-3 overflow-y-auto h-full`}>
        <div>
          {files.map((file, index) => (
            <div
              key={index}
              className={`hover:bg-gray-100 focus:bg-gray-100 active:bg-gray-100 cursor-pointer relative py-1`}
              onClick={e => handleFileSingleClick(file)}
              onDoubleClick={e => handleFileDoubleClick(file)}
              onContextMenu={e => {
                setContextMenu({
                  type: 'zip',
                  x: e.clientX,
                  y: e.clientY,
                  fileInZip: file,
                  parentNode: parentNode
                })
              }}
              tabIndex={0} //TODO you lost the comment saying why we need this...
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
    if (focusedNode.data.fullWidth !== true) focusedNode.setSelected(true) //TODO: is fullWidth check required/sensible?
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
            return -1 // Force expanded row after parent
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

  //TODO: should be encapsulating actual data fields under a key
  const ignoreFields = ['iconBase64', 'id', 'fullWidth', 'parentId', 'parentData', 'files', 'parent']

  // get ALL keys from all objects, use a set and iterate, then map to ag-grid columnDef fields
  const fieldsInRomdata = [...new Set(romdata.flatMap(Object.keys))]
  const columnDefs: (ColDef | ColGroupDef)[] = [
    zipColumn,
    iconColumn,
    ...fieldsInRomdata
      .filter(field => !ignoreFields.includes(field))
      .map(field => ({
        field,
        editable: isEditable,
        valueGetter: field === 'path' ? removeGamesDirPrefix : undefined,
        comparator: createComparator(field)
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
    rowHeight: 30, //this does not play well with auto-height in the zip cell renderer, try scrolling
    headerHeight: 36,
    floatingFiltersHeight: 28,
    // getRowHeight: (params): number | undefined | null => params.data.rowHeight,
    getRowHeight: params => {
      if (params.data.fullWidth) {
        const effectiveFontSize = 16 // --ag-font-size + the 1px alpine theme adds, plus 1px for? 
        const paddingTop = effectiveFontSize / 2 //8px at 16 fontSize: py1 on full-height container ie: 4px top and bottom
        const effectiveOuterPadding = paddingTop + 1 //ag-grid adds 1px padding somewhere: theres still some scroll without it!
        const paddingBetweenItems = effectiveFontSize / 2  //py1 on each item
        const textPadding = 1.5 //from console, text elements are 17.5px tall on effectiveFontSize 16, assume ag-grids adding this somewhere
        const rowItemHeight = effectiveFontSize + textPadding + paddingBetweenItems //25.5 on fontSize 16 
        const maxItemsUntilScrolling = 15 //dont scroll for days if there are many full-width items, v.offputting!
        const itemCount = params.data.files.length
        return itemCount > maxItemsUntilScrolling
          ? maxItemsUntilScrolling * rowItemHeight + effectiveOuterPadding
          : itemCount * rowItemHeight + effectiveOuterPadding
      }
    },
    // fullWidthCellRendererParams: { suppressPadding: true },
    isFullWidthRow: params => params.rowNode.data?.fullWidth === true,
    fullWidthCellRenderer,
    onCellClicked: handleSingleClick,
    onCellDoubleClicked: handleDoubleClick,
    onCellKeyDown: (e: CellKeyDownEvent) => {
      const keyPressed = e.event.key
      console.log('event.key is ' + keyPressed)
      //don't multiple select when arrow keys used for navigation
      if (keyPressed === 'ArrowUp' || keyPressed === 'ArrowDown') preventMultipleSelect(e.api)
      else if (keyPressed === 'Enter') {
        const { path, defaultGoodMerge, emulatorName } = e.node.data
        runGame(path, defaultGoodMerge, emulatorName)
      }
      //prevent the 'i' key from entering field edit whilst trying to type a filter (no idea why it does this)
      else if (keyPressed === 'i') e.event.preventDefault()
    },
    onRowSelected: async function (event) {
      if (event.node.selected && event.node.data.fullWidth !== true) {
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
        path: e.node.data.path,
        defaultGoodMerge: e.node.data.defaultGoodMerge,
        emulatorName: e.node.data.emulatorName
      })
      preventMultipleSelect(e.api)
    },
    getRowId: params =>
      params.data.fullWidth ? params.data.parentId + '-expanded' : params.data.id || params.data.name,
    animateRows: true, //needs getRowId to be set see https://www.youtube.com/watch?v=_V5qFr62uhY
    //prevent the whole full-width row going blue on selection
    getRowStyle: params => params.data.fullWidth && { '--ag-selected-row-background-color': 'white' }
    // onSortChanged: updateRowData,
    // onFilterChanged: updateRowData
  }

  return (
    <>
      <Split sizes={[70, 30]} style={{ height: 'calc(100vh - 7em)', display: 'flex' }}>
        {[
          <div
            key="grid"
            className="ag-theme-alpine"
            style={{
              height: '100%',
              width: '100%',
              //some props only workin in grid options, these only as styles: https://www.ag-grid.com/react-data-grid/global-style-customisation-compactness/
              '--ag-font-size': '14px',
              '--ag-grid-size': '6px'
              // '--ag-row-height': '30', //oddly this doesn't do the same as rowHeight in grid options, seems to just move each rows text uncomfortably to the top?
            }}
          >
            <AgGridReact rowData={rowdata} columnDefs={columnDefs} gridOptions={gridOptions} />
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
            ) : (
              //contextMenu.type === 'rom'
              <>
                <li
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => {
                    console.log('Run Rom')
                    const { path, defaultGoodMerge, emulatorName } = contextMenu
                    runGame(path, defaultGoodMerge, emulatorName)
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
