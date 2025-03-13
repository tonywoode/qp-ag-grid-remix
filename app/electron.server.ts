import electron from 'electron'

const { app, BrowserWindow, ipcMain, shell } = electron

// ipcMain.on('open-external-link', (event, link) => {
//    shell.openExternal(link)
//  })

ipcMain.on('openPath', (event, link) => {
   shell.openPath(link)
 })

// Add window control handlers
ipcMain.on('window-minimize', () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) win.minimize()
})

ipcMain.on('window-maximize', () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) {
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  }
})

ipcMain.on('window-close', () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) win.close()
})

ipcMain.on('toggle-devtools', () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) win.webContents.toggleDevTools()
})

// Add fullscreen handler with event back to renderer
ipcMain.on('toggle-fullscreen', () => {
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
})

// Add zoom handlers with browser-like zoom levels
const ZOOM_LEVELS = [
  0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0, 5.0
];

ipcMain.on('zoom-in', () => {
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
})

ipcMain.on('zoom-out', () => {
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
})

ipcMain.on('zoom-reset', () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) {
    win.webContents.setZoomFactor(1.0)
  }
})

// Add reload handlers
ipcMain.on('reload', () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) win.webContents.reload()
})

ipcMain.on('force-reload', () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) win.webContents.reloadIgnoringCache()
})

export default electron
