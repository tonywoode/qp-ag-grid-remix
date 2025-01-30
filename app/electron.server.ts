import electron from 'electron'
import chokidar from 'chokidar'
import { emitter } from '~/utils/emitter.server'

let currentWatcher: any = null

function watchDir(dirPath: string) {
  if (currentWatcher) {
    currentWatcher.close()
  }

  currentWatcher = chokidar.watch(dirPath, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true,
    depth: 4 // limit depth to avoid excessive scanning
  })
  
  currentWatcher.on('add', path => emitter.emit('directoryChange', { path }))
  currentWatcher.on('unlink', path => emitter.emit('directoryChange', { path }))
  currentWatcher.on('change', path => emitter.emit('directoryChange', { path }))

  return currentWatcher
}

export { watchDir }
export default electron