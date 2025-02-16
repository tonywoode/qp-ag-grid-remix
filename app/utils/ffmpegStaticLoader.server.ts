import { join } from 'path'
import electron from '~/electron.server'
import { pathToFileURL } from 'url'

export function loadFfmpegPath() {
  let unpackedPath
  if (electron.app.isPackaged) {
    const ffmpegPath = join(
      process.resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      'ffmpeg-static',
      process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
    )
    unpackedPath = pathToFileURL(ffmpegPath).toString()
  } else {
    unpackedPath = require('ffmpeg-static')
  }

  return unpackedPath
}
