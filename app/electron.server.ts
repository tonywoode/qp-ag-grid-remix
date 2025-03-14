import electron from 'electron'

const { app, BrowserWindow, ipcMain, shell } = electron

// Increase max listeners to prevent warnings
ipcMain.setMaxListeners(30)

// Extract handler functions so they can be properly removed when needed
const handleOpenPath = (event, link) => {
  shell.openPath(link)
}

const handleWindowMinimize = () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) win.minimize()
}

const handleWindowMaximize = () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) {
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  }
}

const handleWindowClose = () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) win.close()
}

const handleToggleDevtools = () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) win.webContents.toggleDevTools()
}

const handleFullscreen = () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) {
    const newState = !win.isFullScreen()
    win.setFullScreen(newState)

    // Send the new state back to the renderer
    win.webContents.executeJavaScript(`
      window.dispatchEvent(new CustomEvent('electron-fullscreen-change', { 
        detail: ${newState}
      }))
    `)
  }
}

// Add zoom handlers with browser-like zoom levels
const ZOOM_LEVELS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0, 5.0]

const handleZoomIn = () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) {
    const currentZoom = win.webContents.getZoomFactor()

    // Find the next zoom level
    let nextZoomLevel = ZOOM_LEVELS[ZOOM_LEVELS.length - 1] // Default to max if already beyond scale
    for (let i = 0; i < ZOOM_LEVELS.length - 1; i++) {
      if (currentZoom < ZOOM_LEVELS[i] || Math.abs(currentZoom - ZOOM_LEVELS[i]) < 0.001) {
        nextZoomLevel = ZOOM_LEVELS[i + 1]
        break
      }
    }

    win.webContents.setZoomFactor(nextZoomLevel)
  }
}

const handleZoomOut = () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) {
    const currentZoom = win.webContents.getZoomFactor()

    // Find the previous zoom level
    let prevZoomLevel = ZOOM_LEVELS[0] // Default to min if already below scale
    for (let i = ZOOM_LEVELS.length - 1; i > 0; i--) {
      if (currentZoom > ZOOM_LEVELS[i] || Math.abs(currentZoom - ZOOM_LEVELS[i]) < 0.001) {
        prevZoomLevel = ZOOM_LEVELS[i - 1]
        break
      }
    }

    win.webContents.setZoomFactor(prevZoomLevel)
  }
}

const handleZoomReset = () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) {
    win.webContents.setZoomFactor(1.0)
  }
}

const handleReload = () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) win.webContents.reload()
}

const handleForceReload = () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) win.webContents.reloadIgnoringCache()
}

// Remove all existing listeners before adding them again
function removeAllListeners() {
  ipcMain.removeAllListeners('openPath')
  ipcMain.removeAllListeners('window-minimize')
  ipcMain.removeAllListeners('window-maximize')
  ipcMain.removeAllListeners('window-close')
  ipcMain.removeAllListeners('toggle-devtools')
  ipcMain.removeAllListeners('toggle-fullscreen')
  ipcMain.removeAllListeners('zoom-in')
  ipcMain.removeAllListeners('zoom-out')
  ipcMain.removeAllListeners('zoom-reset')
  ipcMain.removeAllListeners('reload')
  ipcMain.removeAllListeners('force-reload')
}

// Setup all listeners fresh
function setupIpcHandlers() {
  // First remove any existing listeners
  removeAllListeners()

  // Then add our handlers
  ipcMain.on('openPath', handleOpenPath)
  ipcMain.on('window-minimize', handleWindowMinimize)
  ipcMain.on('window-maximize', handleWindowMaximize)
  ipcMain.on('window-close', handleWindowClose)
  ipcMain.on('toggle-devtools', handleToggleDevtools)
  ipcMain.on('toggle-fullscreen', handleFullscreen)
  ipcMain.on('zoom-in', handleZoomIn)
  ipcMain.on('zoom-out', handleZoomOut)
  ipcMain.on('zoom-reset', handleZoomReset)
  ipcMain.on('reload', handleReload)
  ipcMain.on('force-reload', handleForceReload)
}

// Setup handlers initially
setupIpcHandlers()

// Listen for app events to redo our handler setup
if (app) {
  app.on('will-quit', removeAllListeners)

  // For development, handle when renderer reloads
  if (process.env.NODE_ENV === 'development') {
    app.on('ready', () => {
      // Re-register handlers when main window is created
      setupIpcHandlers()
    })
  }
}

export default electron
