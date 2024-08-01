const { initRemix } = require('remix-electron')
const { app, BrowserWindow, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

//nasty business due to pdfjs's worker requirement, a recurring issue for all pdf modules that use it
// here's the problem for react-pdf https://github.com/wojtekmaj/react-pdf?tab=readme-ov-file#copy-worker-to-public-directory
// we're currently using pdfslick, problem's the same
const pdfjsDistPath = path.dirname(require.resolve('pdfjs-dist/package.json'))
const pdfWorkerPath = path.join(pdfjsDistPath, 'build', 'pdf.worker.js')

fs.cpSync(pdfWorkerPath, 'public/build/routes/pdfjs-dist/build/pdf.worker.js', { recursive: true })

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
      if (process.env.NODE_ENV === 'development') {
        const { default: installExtension, REACT_DEVELOPER_TOOLS } = require('electron-devtools-installer')

        await installExtension(REACT_DEVELOPER_TOOLS)
      }

      const url = await initRemix({
        serverBuild: path.join(__dirname, '../build/index.js')
      })
      await createWindow(url)
    } catch (error) {
      dialog.showErrorBox('Error', getErrorStack(error))
      console.error(error)
    }
  })()
})

/** @param {unknown} error */
function getErrorStack(error) {
  return error instanceof Error ? error.stack || error.message : String(error)
}
