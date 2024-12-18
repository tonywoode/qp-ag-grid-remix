import { AgGridReact } from 'ag-grid-react'
import AgGridStyles from 'ag-grid-community/styles/ag-grid.css'
import AgThemeAlpineStyles from 'ag-grid-community/styles/ag-theme-alpine.css'
import type { CellKeyDownEvent, CellClickedEvent, GridOptions, ColDef, ColGroupDef, EditableCallbackParams } from 'ag-grid-community'
import { Outlet, useLoaderData, useParams, useNavigate, useFetcher } from '@remix-run/react'
import type { LoaderFunctionArgs } from '@remix-run/node'
import { useEffect, useRef, useState } from 'react'
import Split from 'react-split'
import useClickPreventionOnDoubleClick from '~/utils/doubleClick/use-click-prevention-on-double-click'
import { loadRomdata } from '~/loadRomdata.server' //import { romdata } from '~/../data/Console/Nintendo 64/Goodmerge 3.21 RW/romdata.json' //note destructuring
import { encodeString, decodeString } from '~/utils/safeUrl'
import { loadMameIconBase64 } from '~/loadMameIcons.server'
import { loadIconBase64 } from '~/loadImages.server'
import { logger } from '~/root'

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
        iconBase64: iconBase64 || defaultIconBase64,
        fullWidth: false
      }
    })
  )
  return { romdata: romdataWithIcons }
}

export default function Grid() {
  const gridSize = 6 // --ag-grid-size in px
  const fontSize = 14 // --ag-font-size in px
  const { romdata } = useLoaderData<typeof loader>()
  const [rowdata, setRowdata] = useState(romdata) //another option would have been to use grid-api rather than react state
  const params = useParams()
  const navigate = useNavigate()
  const fetcher = useFetcher<typeof runGameAction>()
  const [clickedCell, setClickedCell] = useState<{ rowIndex: number; colKey: string } | null>(null)
  const [gridKey, setGridKey] = useState(0) //force re-render of grid when romdata changes, no react reconciliation (else icons don't refresh properly)
  const searchTextRef = useRef('')
  const lastKeyPressTimeRef = useRef(0)
  const searchTimeoutRef = useRef<number | null>(null)
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

  const [handleSingleClick, handleDoubleClick] = useClickPreventionOnDoubleClick(
    async (e: CellClickedEvent) => {
      logger.log('gridOperations', 'single click')
      logger.log('gridOperations', e.data)
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

  //TODO: should be encapsulating actual data fields under a key, this is now required both for grid creation and filtering
  const ignoreFields = ['iconBase64', 'id', 'fullWidth', 'parentId', 'parentData', 'files', 'parent']

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
  //AG-grid community doesn't support master/detail, so we have to fake it with full-width rows
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
      logger.log('gridOperations', 'there are ' + files.length + ' files in the zip')
      // Find current position of parent
      let parentIndex = -1
      api.forEachNode((n, index) => {
        if (n.data?.id === rowId) parentIndex = index
      })
      const expandedRowNode = {
        //put the parents DOMAIN props in the expanded row, so that filtering filters the expanded rows too, obv this goes first in the props!
        ...Object.fromEntries(Object.entries(node.data).filter(([key]) => !ignoreFields.includes(key))),
        id: `${rowId}-expanded`,
        fullWidth: true,
        parent: node,
        parentId: rowId,
        parentData: node.data, //fraid so, how else can we satisfy comparison - TODO: now we put the props directly in the expanded row, this needs removal/reworking
        files: files
      }
      //insert after current parent position
      if (parentIndex !== -1) {
        rowdata.splice(parentIndex + 1, 0, expandedRowNode)
        setRowdata([...rowdata])
      }
      //restore focus to the grid (keyboard navigation stops if you expand a row, until you click on a row again)
      //a stretch goal might be to keyboard-navigate the expanded rows, and have some way to exit that back to the grid....
      setTimeout(() => api.setFocusedCell(node.rowIndex, 'name'), 0)
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
        logger.log('gridOperations', 'clicked on file in zip', file)
        //if we aren't on the parent's media panel data (v.important we aren't or the grid will reset), navigate to the parent ROM's url
        //TODO: duping logic in onRowSelected, plus a bad way of composing/checking the url
        const { system, name, mameName, parentName } = parentNode.data
        const basePath = window.location.pathname.split('/').slice(0, -2).join('/')
        const targetUrl = `${basePath}/${encodeString(system)}/${encodeString(name)}`
        const currentUrl = `${window.location.pathname}${window.location.search}`
        logger.log('gridOperations', 'targetUrl', targetUrl)
        logger.log('gridOperations', 'currentUrl', currentUrl)
        logger.log('gridOperations', 'does current url match target?', currentUrl === targetUrl)
        if (currentUrl !== targetUrl) {
          navigate(targetUrl, {
            state: {
              ...(mameName != null && { mameName }),
              ...(parentName != null && { parentName })
            }
          })
        }
      },
      (file: string) => {
        logger.log('gridOperations', 'double clicked on file in zip', file)
      }
    )

    return (
      <div className="py-1 pl-3 overflow-y-auto h-full">
        <div>
          {files.map((file, index) => (
            <div
              key={index}
              className="hover:bg-gray-100 focus:bg-gray-100 active:bg-gray-100 cursor-pointer relative py-1"
              onClick={e => {
                handleFileSingleClick(file)
              }}
              onDoubleClick={e => {
                handleFileDoubleClick(file)
              }}
              onContextMenu={e => {
                setContextMenu({
                  type: 'zip',
                  x: e.clientX,
                  y: e.clientY,
                  fileInZip: file,
                  parentNode: parentNode
                })
              }}
              tabIndex={0} // focusable for TW pseudo selectors to work
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

  //more ag-grid community workarounds: we can't use master/detail, so expanded rows are going to lose their order if we sort
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
  //we want to print the grid when romdata changes, so this has to go here
  useEffect(() => {
    // Update the row data in the grid
    setRowdata(romdata)
    // Increment the key to force re-render
    setGridKey(prevKey => prevKey + 1)
    logger.log('gridOperations', `Creating these columns from romdata: ${params.romdata}`)
    console.table(columnDefs)
  }, [params.romdata]) //don't trigger on romdata alone, will reload when e.g.: you run a game

  const gridOptions: GridOptions = {
    columnDefs,
    defaultColDef: {
      flex: 1,
      minWidth: 150,
      resizable: true,
      sortable: true,
      filter: true,
      floatingFilter: true,
      //don't enter edit mode on the cell if we press enter anywhere when not editing - we're trying to launch the game
      //but also, 'enter' will always quit editing and the game will always run on pressing it, instead: we stop editing manually onKeyDown
      suppressKeyboardEvent: params => params.event.key === 'Enter'
    },
    //because we complete the edit elsewhere, we need to set focus back to the edited cell here, else we'll lose focus
    onCellEditingStopped: e => e.api.setFocusedCell(e.rowIndex, e.column.getId()),
    rowSelection: 'multiple',
    singleClickEdit: true,
    enableGroupEdit: true,
    suppressClickEdit: true,
    rowHeight: 30, //this does not play well with auto-height in the zip cell renderer, try scrolling
    headerHeight: 36,
    floatingFiltersHeight: 28,
    //can't use master/detail in a-g grid community, so we have to work out height ourselves. If the gridSize is changed, the magic numbers here may have to be ascertained from console, and changed
    getRowHeight: params => {
      if (params.data.fullWidth) {
        const effectiveFontSize = fontSize + 2 // ag-grid alpine-theme adds 1px, something else adds another 1px?
        const paddingTop = effectiveFontSize / 2 //8px at 16 effectiveFontSize matches py1 on full-height container ie: 4px top and bottom
        const effectiveOuterPadding = paddingTop + 1 //ag-grid adds 1px padding somewhere: theres still some scroll without it!
        const paddingBetweenItems = effectiveFontSize / 2 //py1 on each item
        const textPadding = 1.5 //from console, text elements are 17.5px tall on effectiveFontSize 16, assume ag-grids adding this somewhere
        const rowItemHeight = effectiveFontSize + textPadding + paddingBetweenItems //25.5 on fontSize 16
        const maxItemsUntilScrolling = 15 //dont scroll for days if there are many full-width items, v.offputting!
        const itemCount = params.data.files.length
        return itemCount > maxItemsUntilScrolling
          ? maxItemsUntilScrolling * rowItemHeight + effectiveOuterPadding
          : itemCount * rowItemHeight + effectiveOuterPadding
      }
    },
    isFullWidthRow: params => params.rowNode.data?.fullWidth === true,
    fullWidthCellRenderer,
    // fullWidthCellRendererParams: { suppressPadding: true },
    onCellClicked: handleSingleClick,
    onCellDoubleClicked: handleDoubleClick,
    onCellKeyDown: (e: CellKeyDownEvent) => {
      const keyPressed = e.event.key
      const timestamp = e.event.timeStamp
      let editing = e.api.getEditingCells().length > 0
      // .some(cell => cell.rowIndex === e.node.rowIndex && cell.column.getId() === e.column.getId())
      logger.log('gridOperations', 'editing is', editing)
      logger.log('gridOperations', 'key pressed is', keyPressed)
      // logger.log('gridOperations', e.api.getEditingCells())
      //check if key is a character key
      if (!editing && keyPressed.length === 1 && keyPressed.match(/\S/)) {
        //compute time since last key press
        const timeSinceLastKeyPress = timestamp - lastKeyPressTimeRef.current
        //compute new search text
        let newSearchText = ''
        if (timeSinceLastKeyPress > 400) newSearchText = keyPressed
        else newSearchText = searchTextRef.current + keyPressed
        searchTextRef.current = newSearchText
        lastKeyPressTimeRef.current = timestamp
        //clear any existing timeout
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
        //reset search text after 1 sec of inactivity
        searchTimeoutRef.current = window.setTimeout(() => (searchTextRef.current = ''), 1000)
        //perform search and navigate to matching row using newSearchText
        const api = e.api
        let startIndex = e.node.rowIndex + 1
        const rowCount = api.getDisplayedRowCount()
        for (let i = 0; i < rowCount; i++) {
          const rowIndex = (startIndex + i) % rowCount
          const node = api.getDisplayedRowAtIndex(rowIndex)
          const data = node.data
          if (data.fullWidth) continue // Skip fullWidth rows
          const cellValue = data.name?.toString().toLowerCase()
          if (cellValue && cellValue.startsWith(newSearchText.toLowerCase())) {
            api.ensureIndexVisible(rowIndex, 'middle')
            api.setFocusedCell(rowIndex, 'name')
            node.setSelected(true, true) //select the row
            break
          }
        }
      } else if (keyPressed === 'ArrowUp' || keyPressed === 'ArrowDown') {
        preventMultipleSelect(e.api)
        //a !editing check won't work here, we'd always have !editing if enter's been pressed
      } else if (keyPressed === 'Enter') {
        const { path, defaultGoodMerge, emulatorName } = e.node.data
        if (editing) e.api.stopEditing() // Manually stop editing THEN run the game
        else runGame(path, defaultGoodMerge, emulatorName)
      }
    },
    onRowSelected: async function (event) {
      if (event.node.selected && event.node.data.fullWidth !== true) {
        logger.log('gridOperations', 'row selected: ', event.rowIndex, event.data)
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
              //some props only work in in grid options, these only as styles: https://www.ag-grid.com/react-data-grid/global-style-customisation-compactness/
              '--ag-font-size': `${fontSize}px`,
              '--ag-grid-size': `${gridSize}px`
              // '--ag-row-height': '30', //oddly this doesn't do the same as rowHeight in grid options, seems to just move each rows text uncomfortably to the top?
            }}
          >
            <AgGridReact key={gridKey} rowData={rowdata} columnDefs={columnDefs} gridOptions={gridOptions} />
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
                  logger.log('gridOperations', 'Set as Default')
                  logger.log('gridOperations', contextMenu)
                  logger.log('gridOperations', clickedCell)
                  const currentDefaultGoodMerge = contextMenu.parentNode.data?.defaultGoodMerge
                  logger.log('gridOperations', 'current goodmerge:', currentDefaultGoodMerge || 'none')
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
                    logger.log('gridOperations', 'Run Rom')
                    const { path, defaultGoodMerge, emulatorName } = contextMenu
                    runGame(path, defaultGoodMerge, emulatorName)
                  }}
                >
                  Run Rom
                </li>
                <li
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => logger.log('gridOperations', 'Action 2')}
                >
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
