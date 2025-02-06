import { join } from 'path'
import electron from '~/electron.server'

export async function loadFfmpeg() {
  const unpackedPath = electron.app.isPackaged
    ? join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'fluent-ffmpeg', 'index.js')
    : 'fluent-ffmpeg'
  const ffmpegModule = await import(unpackedPath)
  return ffmpegModule.default
}
