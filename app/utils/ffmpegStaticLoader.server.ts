import { join } from 'path'
import electron from '~/electron.server'

export function loadFfmpegPath() {
  return electron.app.isPackaged
    ? join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', 'ffmpeg')
    : require('ffmpeg-static')
}
