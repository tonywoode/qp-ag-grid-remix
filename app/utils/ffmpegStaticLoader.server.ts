import { join } from 'path'
import electron from '~/electron.server'
import { pathToFileURL } from 'url'

export function loadFfmpegPath() {
  //TODO: only include .exe if we're on windows!
  let unpackedPath = electron.app.isPackaged
    ? join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe')
    : require('ffmpeg-static')
  if (electron.app.isPackaged) {
    // 'convert path to URL for ESM loader
    unpackedPath = pathToFileURL(unpackedPath).toString()
  }
  return unpackedPath
}
