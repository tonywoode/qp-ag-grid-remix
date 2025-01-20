import { AgGridReact } from 'ag-grid-react'
import AgGridStyles from 'ag-grid-community/styles/ag-grid.css'
import AgThemeAlpineStyles from 'ag-grid-community/styles/ag-theme-alpine.css'
import type {
  CellKeyDownEvent,
  CellClickedEvent,
  GridOptions,
  ColDef,
  ColGroupDef,
  EditableCallbackParams,
  GridApi
} from 'ag-grid-community'
import { Outlet, useLoaderData, useParams, useNavigate, useFetcher } from '@remix-run/react'
import type { LoaderFunctionArgs } from '@remix-run/node'
import { useEffect, useRef, useState, useCallback } from 'react'
import Split from 'react-split'
import useClickPreventionOnDoubleClick from '~/utils/doubleClick/use-click-prevention-on-double-click'
import { loadRomdata } from '~/loadRomdata.server' //import { romdata } from '~/../data/Console/Nintendo 64/Goodmerge 3.21 RW/romdata.json' //note destructuring
import { encodeString, decodeString } from '~/utils/safeUrl'
import { loadMameIconBase64 } from '~/loadMameIcons.server'
import { loadIconBase64 } from '~/loadImages.server'
import { logger } from '~/root'
import { GameProgressModal } from '~/components/GameProgressModal'
import { useEventSource } from 'remix-utils/sse/react'
import { sevenZipFileExtensions } from '~/utils/fileExtensions'
// import { FaFile, FaFileAlt, FaFileArchive, FaCloudDownloadAlt, FaTimesCircle } from 'react-icons/fa'
import {
  FaFileCircleMinus,
  FaFileZipper,
  FaFileCirclePlus,
  FaFileCircleXmark,
  FaFileCircleCheck
} from 'react-icons/fa6'
import { CiCirclePlus, CiCircleMinus } from 'react-icons/ci'
import { throttle } from '~/utils/throttle'

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
  const rowBuffer = 10 //10 is the default, but specify it as we use this in the calculation of visible rows
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
  //separate the modal's SSE connection from its invocation: modal can then have a key, SEE more stable
  const eventData = useEventSource('/stream', { event: 'runGameEvent' })
  const [gameProgress, setGameProgress] = useState<{
    isRunning: boolean
    name: string
    path: string
    status: string
    logs: string[]
  } | null>(null)
  const [fileStatuses, setFileStatuses] = useState<Record<string, boolean>>({})
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
    api: GridApi
  }
  type ContextMenu = RomContextMenu | ZipContextMenu
  const gridRef = useRef<AgGridReact>(null)

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  useEffect(() => {
    //when right-click grid menus are opened, close them when clicking anywhere else in the app
    const handleClickOutside = () => setContextMenu(null)
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  useEffect(() => {
    let isCancelled = false
    async function checkFiles() {
      const paths = romdata.map(item => item.path)
      const resp = await fetch('/fileExistsBatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths })
      })
      const { results } = await resp.json()
      if (!isCancelled) {
        romdata.forEach(item => {
          setFileStatuses(prev => ({ ...prev, [item.id]: results[item.path] }))
        })
      }
    }
    checkFiles()
    return () => {
      isCancelled = true
    }
  }, [romdata])

  const [handleSingleClick, handleDoubleClick] = useClickPreventionOnDoubleClick(
    async (e: CellClickedEvent) => {
      logger.log('gridOperations', 'single click')
      logger.log('gridOperations', 'data:', e.data)
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

  function runGame(gamePath: string, fileInZipToRun: string, emulatorName: string) {
    function getBaseName(p: string) {
      return p.substring(Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/')) + 1)
    }

    if (gameProgress?.isRunning) {
      const confirmRun = confirm(`Game ${gameProgress.name} is still running. Are you sure you want to run a new game?`)
      if (!confirmRun) return
    }

    setGameProgress({
      isRunning: true,
      name: getBaseName(gamePath),
      path: gamePath,
      status: 'Starting...',
      logs: [] // Reset logs at the start of each run
    })

    fetcher.submit(
      { gamePath, fileInZipToRun, emulatorName },
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
    minWidth: 66,
    maxWidth: 66,
    //autoHeight: true, //in combination with (style) rowHeight, makes the grid all wobbly on scroll
    filter: false,
    suppressSizeToFit: true, //TODO: make icon (and later potentially logo) autosize with rowheight/width changes
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
  const toggleExpandedRow = async (rowId: string, api: GridApi, node: any) => {
    const expandedNode = api.getRowNode(`${rowId}-expanded`)
    let currentIndex = -1
    let parentIndex = -1

    if (expandedNode) {
      // Find current position of expanded row
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

        //fix for 'jumping' sorted expansions: scroll end-of-list expansions into view but only activate when absolutely necessary as causes sorted list to jank
        console.log('real (pre-sort) parent index', parentIndex)
        const postSortParentIndex = getPostSortIndex(api, rowId)
        handleExpandedRowVisibility(api, rowBuffer, parentIndex, postSortParentIndex, files)
      }
      //restore focus to the grid (keyboard navigation stops if you expand a row, until you click on a row again)
      setTimeout(() => api.setFocusedCell(node.rowIndex, 'name'), 0)
    }
  }

  const getFileExtension = (filename: string) => filename.substring(filename.lastIndexOf('.'))

  function ZipStatusIcon({ isExpanded }) {
    return (
      <div className="relative inline-flex">
        <FaFileZipper className="text-blue-500 text-3xl" />
        <div className="absolute bottom-0 right-2 translate-x-3 translate-y-1 ">
          {isExpanded ? (
            <CiCircleMinus className="text-white text-lg stroke-2 filter backdrop-brightness-100" />
          ) : (
            <CiCirclePlus className="text-white text-lg stroke-2 filter backdrop-brightness-100" />
          )}
        </div>
      </div>
    )
  }

  const zipColumn = {
    headerName: '',
    field: 'zip',
    headerComponent: 'agColumnHeader',
    //sadly the only way to get a sortable file header seems to be to recreate the svg
    headerComponentParams: {
      template: `
        <div class="ag-cell-label-container" role="presentation">
          <span ref="eMenu" class="ag-header-icon ag-header-cell-menu-button"></span>
          <div ref="eLabel" class="ag-header-cell-label" role="presentation">
            <svg class="text-blue-500 w-5 h-5" fill="currentColor" viewBox="0 0 512 512">
              <path d="M64 0C28.7 0 0 28.7 0 64V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V160H256c-17.7 0-32-14.3-32-32V0H64zM256 0V128H384L256 0z"/>
            </svg>
            <span ref="eSortOrder" class="ag-header-cell-sorted-asc"></span>
            <span ref="eSortAsc" class="ag-header-cell-sorted-desc"></span>
            <span ref="eSortDesc" class="ag-header-cell-sorted-none"></span>
          </div>
        </div>
      `
    },
    minWidth: 60, //TODO: annoying as its a bit too wide, however the header text doesn't git otherwise - header padding?
    maxWidth: 60,
    filter: false,
    suppressSizeToFit: true,
    sortable: true,
    //note custom logic for this field in generic comparator (else you'd have to duplicate full-width logic here)
    comparator: createComparator('zip'),
    cellRenderer: ({ data, api, node }) => {
      const isExpandable = sevenZipFileExtensions.includes(getFileExtension(data.path).toLowerCase())
      const exists = fileStatuses[data.id]
      const isExpanded = Boolean(api.getRowNode(`${data.id}-expanded`))
      return (
        <div className="w-full h-full flex items-center justify-center">
          {!exists && (
            <span className="text-red-600 text-3xl">
              <FaFileCircleXmark />
            </span>
          )}
          {exists &&
            (isExpandable ? (
              <button
                className="text-blue-500 hover:text-blue-700"
                onClick={async () => toggleExpandedRow(data.id, api, node)}
              >
                <ZipStatusIcon isExpanded={isExpanded} />
              </button>
            ) : (
              <span className="text-green-500 text-3xl">
                <FaFileCircleCheck />
              </span>
            ))}
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
        //prettier-ignore (keeps wanting a semi at the front!)
        logger.log('gridOperations', 'clicked on file in zip', file)
        //if we aren't on the parent's media panel data (v.important we aren't or the grid will reset), navigate to the parent ROM's url
        //TODO: duping logic in onRowSelected, plus a bad way of composing/checking the url
        const { system, name, mameName, parentName } = parentNode.data
        const basePath = window.location.pathname.split('/').slice(0, -2).join('/')
        const targetUrl = `${basePath}/${encodeString(system)}/${encodeString(name)}`
        const currentUrl = `${window.location.pathname}${window.location.search}`
        logger.log('gridOperations', 'current url matches target?', currentUrl === targetUrl, ', current:', currentUrl)
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
        const { path, emulatorName } = params.data //runGame but use file instead of defaultGoodMerge
        runGame(path, file, emulatorName)
      }
    )

    return (
      <div className="py-1 pl-36 overflow-y-auto h-full">
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
                  parentNode: parentNode,
                  api: params.api
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
  function createComparator(field: string) {
    // console.log(field)
    //TODO: casing in the data is all messed up: 'year', 'rating, 'timesPlayed' and 'ParamMode'
    const numericFields = ['year', 'rating', 'timesPlayed', 'ParamMode']
    return (valueA: any, valueB: any, nodeA: any, nodeB: any, isDescending: boolean) => {
      const nodeAId = nodeA.data?.id
      const nodeBId = nodeB.data?.id
      const parentAId = nodeA.data?.parentId
      const parentBId = nodeB.data?.parentId
      const isNodeAFullWidth = nodeA.data?.fullWidth
      const isNodeBFullWidth = nodeB.data?.fullWidth
      //all we want is for this column to sort by exists, but full-width rows must also be considered
      if (field === 'zip') {
        let existsA = fileStatuses[nodeAId] ? 1 : 0
        let existsB = fileStatuses[nodeBId] ? 1 : 0
        //If one is a full-width row, compare based on parent
        if (isNodeAFullWidth || isNodeBFullWidth) {
          if (isNodeAFullWidth) existsA = fileStatuses[parentAId] ? 1 : 0
          if (isNodeBFullWidth) existsB = fileStatuses[parentBId] ? 1 : 0
        }
        return existsB - existsA //invert this one - its rare you want the FIRST click to show missing files first
      }
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
      //empty values ALWAYS sort last, regardless of direction, note the returns above are for special cases
      const isEmptyA = valueA === null || valueA === undefined || valueA === ''
      const isEmptyB = valueB === null || valueB === undefined || valueB === ''
      if (isEmptyA !== isEmptyB) {
        //flip return value based on sort direction to keep empties last
        return isEmptyA ? (isDescending ? -1 : 1) : isDescending ? 1 : -1
      }
      //both empty, treat as equal
      if (isEmptyA && isEmptyB) return 0
      //handle non-empty numeric fields
      if (numericFields.includes(field)) {
        const numA = Number(valueA)
        const numB = Number(valueB)
        //rating in data is sometimes a string sometimes number (do we want to check all columns like this instead of having exclusion coulumnns?)
        if (field === 'Rating' && (isNaN(numA) || isNaN(numB))) {
          return String(valueA).localeCompare(String(valueB))
        }
        return numA - numB // Let AG Grid handle direction
      }
      //handle non-empty strings
      return String(valueA).localeCompare(String(valueB))
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
      })),
    {
      //dummy column to allow the final column's cells to be expanded to the right (to read their contents)
      headerName: '',
      field: 'dummy',
      minWidth: 0,
      maxWidth: 0,
      resizable: false,
      filter: false,
      suppressMovable: true,
      suppressSizeToFit: true,
      cellRenderer: () => null
    }
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

  const throttledNavigate = useCallback(
    throttle((system: string, romname: string, state: any) => {
      navigate(`${encodeString(system)}/${encodeString(romname)}`, { state })
    }, 0),
    [navigate]
  )

  const onRowSelected = useCallback(
    (event: RowSelectedEvent) => {
      if (event.node.selected && !event.node.data.fullWidth) {
        logger.log('gridOperations', 'row selected: ', event.rowIndex, event.data)
        const { system, name: romname, mameName, parentName } = event.data
        //include mamenames as location state if they exist
        throttledNavigate(system, romname, {
          ...(mameName != null && { mameName }),
          ...(parentName != null && { parentName })
        })
      }
    },
    [throttledNavigate]
  )

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
    onRowSelected,
    suppressRowDeselection: true, // Prevent deselection during scroll - speedup and helps 'the user aborted a request'
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
    getRowStyle: params => params.data.fullWidth && { '--ag-selected-row-background-color': 'white' },
    rowBuffer
    // onSortChanged: updateRowData,
    // onFilterChanged: updateRowData
  }

  return (
    <>
      <Split sizes={[70, 30]} style={{ height: 'calc(100vh - 7em)', display: 'flex' }}>
        <div
          key="grid"
          className="ag-theme-alpine"
          style={{
            height: '100%',
            width: '100%',
            '--ag-font-size': `${fontSize}px`,
            '--ag-grid-size': `${gridSize}px`
          }}
        >
          <AgGridReact
            key={gridKey}
            rowData={rowdata}
            columnDefs={columnDefs}
            gridOptions={gridOptions}
            ref={gridRef}
          />
        </div>
        <div key="mediaPanel" className="h-full overflow-auto">
          <Outlet key="outlet" />
        </div>
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
                  logger.log('gridOperations', 'context menu', contextMenu)
                  logger.log('gridOperations', 'clicked cell', clickedCell)
                  const currentDefaultGoodMerge = contextMenu.parentNode.data?.defaultGoodMerge
                  logger.log(
                    'gridOperations',
                    'current goodmerge:',
                    currentDefaultGoodMerge || 'none',
                    ', setting new goodmerge: ',
                    contextMenu.fileInZip
                  )
                  // Update the currentDefaultGoodMerge cell in the row
                  const api = contextMenu.api
                  const rowNode = api.getRowNode(contextMenu.parentNode.id)
                  if (rowNode) {
                    rowNode.setDataValue('defaultGoodMerge', contextMenu.fileInZip)
                  }
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
      <GameProgressModal
        isOpen={!!gameProgress?.isRunning}
        //make a unique key for each invocation, it can't be the game name, maybe the time?
        key={gameProgress?.path}
        onClose={() => {
          setGameProgress(null)
          // TODO: Add logic to cancel game process
        }}
        gameDetails={gameProgress || { name: '', path: '', status: '', logs: [] }}
        eventData={eventData}
      />
    </>
  )
}

//remove the string {GamesDir}\ from the start of all path fields TODO: should have a lit button showing gameDir substitution is active
function removeGamesDirPrefix({ data: { path } }) {
  return path.replace('{gamesDir}\\', '')
}

function getPostSortIndex(api: GridApi, rowId: string) {
  let postSortIndex = -1
  api.forEachNodeAfterFilterAndSort((n, index) => {
    if (n.data?.id === rowId) postSortIndex = index
  })
  console.log('postSortParentIndex', postSortIndex)
  return postSortIndex
}

//more community-edition workarounds, we want to scroll last-visible rows into view if expanded, needs to work in sorted list, but janks so minimise WHEN to do so
function handleExpandedRowVisibility(
  api: GridApi,
  rowBuffer: number,
  parentIndex: number,
  postSortIndex: number,
  files: any[]
) {
  const { lastVisibleNoBuffer, lastVisibleWithBuffer, firstPossibleLastVisible } = calculateVisibleRowIndices(
    api,
    rowBuffer
  )
  const isAtEndWithRowBuffer = firstPossibleLastVisible < lastVisibleWithBuffer
  logger.log('gridOperations', 'postSortParentIndexIsLast10', isAtEndWithRowBuffer)

  //if we're not near the end of the list and our index is the last visible (-1 as we can't be pixel perfect)
  if (!isAtEndWithRowBuffer && postSortIndex >= lastVisibleNoBuffer - 1) {
    logger.log('gridOperations', 'ensuring last visible row expansion (not at list end) is visible')
    const numRowsToExpand = 14 //real number is pix-height, so magic this is
    api.ensureIndexVisible(parentIndex + Math.min(files.length, numRowsToExpand), 'bottom')
  }
  //if we are, the best we can do is always ensure last 10/row buffer visible (consider we may be scrolled such that the 3rd-last-to-end is lastVisible)
  if (isAtEndWithRowBuffer && postSortIndex > firstPossibleLastVisible) {
    logger.log('gridOperations', 'ensuring last visible row expansion (at list end) is visible')
    api.ensureIndexVisible(Math.min(parentIndex + 1, files.length), 'bottom')
    //there is however a bug where on first-render attempt to expand the very last item in a fileAvailable sorted list, it doesn't expand
  }
}

function calculateVisibleRowIndices(api: GridApi, rowBuffer: number) {
  const totalRows = api.getDisplayedRowCount()
  //last visbile row includes ag-grid's scroll-performance row-buffer, so isn't really the last-visible at all
  const lastVisibleWithBuffer = api.getLastDisplayedRow()
  const lastVisibleNoBuffer = lastVisibleWithBuffer - rowBuffer
  //its impossible to get the last visible row if its within 10 of the total rows, best we can do is operate if we're within the last 10/row buffer
  const firstPossibleLastVisible = totalRows - rowBuffer
  logger.log('gridOperations', 'totalRows', totalRows)
  logger.log('gridOperations', 'lastVisibleRowWithBufferIndex', lastVisibleWithBuffer)
  logger.log('gridOperations', 'lastVisibleRowIndex_noBuffer', lastVisibleNoBuffer)
  logger.log('gridOperations', 'firstPossibleLastVisibleRowIndex', firstPossibleLastVisible)
  return { lastVisibleWithBuffer, lastVisibleNoBuffer, firstPossibleLastVisible }
}

export function links() {
  return [
    { rel: 'stylesheet', href: AgGridStyles },
    { rel: 'stylesheet', href: AgThemeAlpineStyles }
  ]
}
