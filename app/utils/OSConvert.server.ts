import path from 'path'
import { logger } from '~/root'
import { systemPaths } from '~/config/gamePaths.server'

//TODO: Not production ready, these fns reflect me virtualising and/or partitioning a dual mac/win x64 system, hence the windows paths and the mac paths represent the SAME physical locations seen from different OSes

//I need a function to detect the OS and convert paths accordingly
export function convertPathToOSPath(inputPath: string) {
  const os = process.platform
  logger.log('pathConversion', 'Detected OS:', os)
  return os === 'win32' ? convertMacPathToWindowsPath(inputPath) : convertWindowsPathToMacPath(inputPath)
}

//TODO: This is AI generated
function convertMacPathToWindowsPath(macPath: string) {
  logger.log('pathConversion', 'Original macOS or gamesDir path:', macPath)
  macPath = macPath.replace(systemPaths.gamesRoot, '{gamesDir}')
  let components = macPath.split('/')
  logger.log('pathConversion', 'Split path components:', components)
  if (components[0] === systemPaths.gamesRoot) components[0] = systemPaths.gamesRoot
  else if (components[0] === systemPaths.emulatorsRoot) components[0] = systemPaths.emulatorsRoot
  let winPath = path.join(...components)
  winPath = path.normalize(winPath)
  logger.log('pathConversion', 'Converted macOS path:', winPath)
  return winPath
}

//This is NOT AI generated!
function convertWindowsPathToMacPath(winPath: string) {
  //define macOS games directory path
  logger.log('pathConversion', 'Original Windows or gamesDir path:', winPath)
  //replace {gamesDir} with macOS games directory path
  winPath = winPath.replace(/^\{gamesDir\}/, systemPaths.gamesRoot)
  //split path into components
  let components = winPath.split('\\')
  logger.log('pathConversion', 'Split path components:', components)
  //replace drive letter with appropriate root directory
  if (components[0] === systemPaths.gamesRoot) components[0] = systemPaths.gamesRoot
  else if (components[0] === systemPaths.emulatorsRoot) components[0] = systemPaths.emulatorsRoot
  //join components back together and normalize path
  let macPath = path.join(...components)
  macPath = path.normalize(macPath)
  logger.log('pathConversion', 'Converted Windows path:', macPath)
  return macPath
}
