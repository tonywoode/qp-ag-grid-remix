import electron from 'electron'

const { app, BrowserWindow, ipcMain, shell } = electron

// ipcMain.on('open-external-link', (event, link) => {
//    shell.openExternal(link)
//  })

ipcMain.on('openPath', (event, link) => {
   shell.openPath(link)
 })
export default electron
