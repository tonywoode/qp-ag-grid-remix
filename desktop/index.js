const { initRemix } = require('remix-electron')
const { app, BrowserWindow, dialog, Menu } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const log = require('electron-log')

// Check for fullscreen command line argument
const isFullScreenArg = process.argv.includes('--fullscreen')

// Configure electron-log to use our OS-aware base directory
log.transports.file.resolvePath = () => {
  const baseDir = getBaseDirectory()
  
  // Create logs directory within our base directory
  const logsDir = path.join(baseDir, 'logs')
  
  // Ensure the logs directory exists
  if (!fs.existsSync(logsDir)) {
    try {
      fs.mkdirSync(logsDir, { recursive: true })
    } catch (err) {
      console.error('Failed to create logs directory:', err)
    }
  }
  
  // Return path to log directory, letting electron-log handle the file naming
  return path.join(logsDir, 'main.log')
}

// We can still set some preferences that work with electron-log's rotation
log.transports.file.maxSize = 10 * 1024 * 1024 // 10MB before rotation
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'

/** @type {BrowserWindow | undefined} */
let win

/** @param {string} url */
async function createWindow(url) {
  win = new BrowserWindow({
    show: false,
    // Use standard framed windows on both platforms
    frame: true,
    // Use default titlebar style on all platforms
    titleBarStyle: 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // Check if we should start in fullscreen
  if (isFullScreenArg) {
    win.setFullScreen(true)
    // Log that we're starting in fullscreen mode
    log.info('Starting application in fullscreen mode due to --fullscreen flag')
  } else {
    // Explicitly ensure we're not in fullscreen if the flag isn't present
    win.setFullScreen(false)
  }

  // Still maximize the window but now it will have proper chrome
  // Only maximize if not in fullscreen mode
  if (!isFullScreenArg) {
    win.maximize()
  }

  await win.loadURL(url)
  win.show()

  // Notify the renderer process about fullscreen state on load
  if (isFullScreenArg) {
    win.webContents.executeJavaScript(`
      window.dispatchEvent(new CustomEvent('electron-fullscreen-change', { 
        detail: true 
      }))
    `)
  }

  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools()
  }
}

// Create application menu with shortcuts but don't display it on Windows
const menuTemplate = [
  {
    label: 'File',
    submenu: [
      { role: 'quit' }
    ]
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn', accelerator: 'CommandOrControl+=' }, // Ensure Ctrl+= works too
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
      { type: 'separator' },
      { role: 'toggleDevTools' }
    ]
  }
];

// Create menu from template
if (process.platform === 'win32') {
  const menu = Menu.buildFromTemplate(menuTemplate)
  Menu.setApplicationMenu(menu)

  // This sets up the app to have the menu functionality without showing it
  app.on('browser-window-created', (_, browserWindow) => {
    browserWindow.setMenuBarVisibility(false)
  })
}

app.on('ready', () => {
  void (async () => {
    try {
      // Setup electron-log but don't redirect console yet
      // We'll do conditional console redirection after checking config

      // Create a plain logger for startup messages
      log.info('QuickPlay starting up')

      //set working directory for packaged app
      if (app.isPackaged) {
        process.chdir(path.join(app.getAppPath(), '..'))
      }

      // Check for logger config to see if disk logging is enabled
      const configPath = path.join(getBaseDirectory(), 'loggerConfig.json')
      let enableDiskLogging = false

      try {
        if (fs.existsSync(configPath)) {
          const configData = fs.readFileSync(configPath, 'utf-8')
          const config = JSON.parse(configData)
          const diskLoggingConfig = config.find(item => item.feature === 'diskLogging')
          enableDiskLogging = diskLoggingConfig?.enabled || false
          log.info(`Disk logging enabled: ${enableDiskLogging}`)
        }
      } catch (err) {
        log.error('Error reading logger config:', err)
      }

      // Only redirect console to log file if disk logging is enabled
      if (enableDiskLogging) {
        // Save original console methods
        const originalConsoleLog = console.log
        const originalConsoleError = console.error

        // Create wrapper functions that strip ANSI color codes before logging to disk
        console.log = (...args) => {
          // Strip ANSI color codes if the argument is a string
          const cleanArgs = args.map(arg => (typeof arg === 'string' ? arg.replace(/\x1b\[[0-9;]*m/g, '') : arg))

          // Log to disk with clean args
          log.log(...cleanArgs)

          // Still log to console with original formatting
          originalConsoleLog(...args)
        }

        console.error = (...args) => {
          // Strip ANSI color codes if the argument is a string
          const cleanArgs = args.map(arg => (typeof arg === 'string' ? arg.replace(/\x1b\[[0-9;]*m/g, '') : arg))

          // Log to disk with clean args
          log.error(...cleanArgs)

          // Still log to console with original formatting
          originalConsoleError(...args)
        }

        log.info('Console output redirected to log file')
      } else {
        log.info('Disk logging disabled - console output will not be saved')
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

// Helper function to get the base directory (mirroring your dataLocations.server.ts logic)
function getBaseDirectory() {
  if (process.env.NODE_ENV === 'development') {
    return path.join(__dirname, '..')
  }

  if (process.platform === 'darwin') {
    return app.getPath('userData')
  } else {
    return path.dirname(app.getPath('exe'))
  }
}

/** @param {unknown} error */
function getErrorStack(error) {
  return error instanceof Error ? error.stack || error.message : String(error)
}
