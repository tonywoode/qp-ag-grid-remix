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

// Add zoom handlers
ipcMain.on('zoom-in', () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) {
    const currentZoom = win.webContents.getZoomFactor()
    win.webContents.setZoomFactor(currentZoom + 0.1)
  }
})

ipcMain.on('zoom-out', () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) {
    const currentZoom = win.webContents.getZoomFactor()
    win.webContents.setZoomFactor(Math.max(0.1, currentZoom - 0.1))
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
