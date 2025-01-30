import electron from 'electron'
import chokidar from 'chokidar'
import { emitter } from '~/utils/emitter.server'

let currentWatcher: chokidar.FSWatcher | null = null
let watcherReady = false

function watchDir(dirPath: string) {
  try {
    if (currentWatcher) {
      currentWatcher.close()
      currentWatcher = null
      watcherReady = false
    }

    // Don't start watching if directory doesn't exist
    if (!require('fs').existsSync(dirPath)) {
      return null
    }

    currentWatcher = chokidar.watch(dirPath, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      ignoreInitial: true,
      depth: 4,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    })
    
    currentWatcher.on('ready', () => {
      watcherReady = true
      if (currentWatcher) {
        currentWatcher
          .on('add', path => watcherReady && emitter.emit('directoryChange', { path }))
          .on('unlink', path => watcherReady && emitter.emit('directoryChange', { path }))
          .on('change', path => watcherReady && emitter.emit('directoryChange', { path }))
      }
    })

    return currentWatcher
  } catch (error) {
    console.error('Error setting up watcher:', error)
    return null
  }
}

function closeWatcher() {
  if (currentWatcher) {
    watcherReady = false
    currentWatcher.close()
    currentWatcher = null
  }
}

// Add pause/resume functionality
function pauseWatcher() {
  watcherReady = false
}

function resumeWatcher() {
  watcherReady = true
}

export { watchDir, closeWatcher, pauseWatcher, resumeWatcher }
export default electron