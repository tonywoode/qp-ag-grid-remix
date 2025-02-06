const { initRemix } = require('remix-electron')
const { app, BrowserWindow, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const log = require('electron-log')

/** @type {BrowserWindow | undefined} */
let win

/** @param {string} url */
async function createWindow(url) {
  win = new BrowserWindow({ show: false })
  win.maximize()
  await win.loadURL(url)
  win.show()

  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools()
  }
}

app.on('ready', () => {
  void (async () => {
    try {
      // redirect console to log file
      console.log = log.log
      console.error = log.error

      log.info('App starting from:', process.cwd())
      log.info('__dirname:', __dirname)
      log.info('app.getAppPath():', app.getAppPath())
      //set working directory for packaged app
      if (app.isPackaged) {
        process.chdir(path.join(app.getAppPath(), '..'))
      }

      if (process.env.NODE_ENV === 'development') {
        const { default: installExtension, REACT_DEVELOPER_TOOLS } = require('electron-devtools-installer')
        await installExtension(REACT_DEVELOPER_TOOLS)
      }

      const serverBuildPath = path.join(app.getAppPath(), 'build/index.js')
      log.info('Loading server build from:', serverBuildPath)

      const url = await initRemix({
        serverBuild: serverBuildPath
      })
      await createWindow(url)
    } catch (error) {
      log.error('Full error details:', error)
      dialog.showErrorBox('Error', getErrorStack(error))
    }
  })()
})

/** @param {unknown} error */
function getErrorStack(error) {
  return error instanceof Error ? error.stack || error.message : String(error)
}
