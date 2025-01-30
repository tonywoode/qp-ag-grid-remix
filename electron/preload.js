const { contextBridge, ipcRenderer } = require('electron')
const chokidar = require('chokidar')

contextBridge.exposeInMainWorld('electron', {
  // ...existing exposed methods...
  
  watchDir: (path, callback) => {
    const watcher = chokidar.watch(path, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true
    })
    watcher.on('change', callback)
    return watcher
  },

  revalidateRoot: () => {
    // Trigger a custom event that Remix will listen for
    window.dispatchEvent(new CustomEvent('remix-reload'))
  }
})
