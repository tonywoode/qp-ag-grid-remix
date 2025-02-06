import { join } from 'path'
import electron from '~/electron.server'
import { pathToFileURL } from 'url'

export async function loadFfmpeg() {
  let unpackedPath = electron.app.isPackaged
    ? join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'fluent-ffmpeg', 'index.js')
    : 'fluent-ffmpeg'

  if (electron.app.isPackaged) {
    // 'convert path to URL for ESM loader on windows
    unpackedPath = pathToFileURL(unpackedPath).toString()
  }
  const ffmpegModule = await import(unpackedPath)
  return ffmpegModule.default
}
