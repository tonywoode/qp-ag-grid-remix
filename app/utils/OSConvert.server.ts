import path from 'path'
import { platform } from 'os'
import { logger } from '~/dataLocations.server'
import { paths } from '~/config/gamePaths.server'

//TODO: Not production ready, these fns reflect me virtualising and/or partitioning a dual mac/win x64 system, hence the windows paths and the mac paths represent the SAME physical locations seen from different OSes

//get current OS and paths for both systems
const currentOS = platform()
const winPaths = paths.win32
const macPaths = paths.darwin

export function convertPathToOSPath(inputPath: string) {
  logger.log('pathConversion', `Converting path for OS: ${currentOS}`)
  logger.log('pathConversion', 'Input path:', inputPath)
  const result = currentOS === 'win32' ? convertPathToWindowsPath(inputPath) : convertPathToMacPath(inputPath)
  logger.log('pathConversion', 'Converted path:', result)
  return result
}

//TODO: still universally replacing the gamesDir placeholder, created at data import time: is this really ideal?
//TODO: mac to win paths untested
function convertPathToWindowsPath(incomingPath: string) {
  //replace games dir polaceholder with win root
  const unvirtualisedPath = incomingPath.replace(/^\{gamesDir\}/, winPaths.gamesRoot)
  let components = unvirtualisedPath.split('/')
  //replace root directory with appropriate drive letter
  if (components[0] === macPaths.gamesRoot) components[0] = winPaths.gamesRoot
  else if (components[0] === macPaths.emulatorsRoot) components[0] = winPaths.emulatorsRoot
  let winPath = path.join(...components)
  return winPath
}

function convertPathToMacPath(incomingPath: string) {
  //replace {gamesDir} with macOS games directory path
  const unvirtualisedPath = incomingPath.replace(/^\{gamesDir\}/, macPaths.gamesRoot)
  let components = unvirtualisedPath.split('\\')
  //replace drive letter with appropriate root directory
  if (components[0] === winPaths.gamesRoot) components[0] = macPaths.gamesRoot
  else if (components[0] === winPaths.emulatorsRoot) components[0] = macPaths.emulatorsRoot
  //join components back together and normalize path
  let macPath = path.join(...components)
  return macPath
}
