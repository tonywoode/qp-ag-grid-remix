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

// Add fullscreen handler
ipcMain.on('toggle-fullscreen', () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) {
    // Toggle the fullscreen state
    const newState = !win.isFullScreen()
    win.setFullScreen(newState)

    // If we're exiting fullscreen, make sure we have the proper window frame settings
    if (!newState && process.platform === 'win32') {
      win.setMenuBarVisibility(false)
    }
  }
})

export default electron
