
import { join } from 'path'
import electron from '~/electron.server'

export async function loadNode7z() {
  const unpackedPath = electron.app.isPackaged
    ? join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'node-7z-archive', 'lib', 'index.js')
    : 'node-7z-archive'
  return import(unpackedPath)
}