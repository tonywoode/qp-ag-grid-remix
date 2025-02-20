import electron from '~/electron.server'

export function loadFfmpegPath() {
  let unpackedPath
  if (electron.app.isPackaged) {
    unpackedPath = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked')
  } else {
    unpackedPath = require('ffmpeg-static')
  }
  return unpackedPath
}
