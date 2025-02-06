
import { join } from 'path'
import electron from '~/electron.server'
import { pathToFileURL } from 'url'

export async function loadNode7z() {
  let unpackedPath = electron.app.isPackaged
    ? join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'node-7z-archive', 'lib', 'index.js')
    : 'node-7z-archive'

    if (electron.app.isPackaged) {
      // 'convert path to URL for ESM loader on windows
      unpackedPath = pathToFileURL(unpackedPath).toString()
    }
  return import(unpackedPath)
}