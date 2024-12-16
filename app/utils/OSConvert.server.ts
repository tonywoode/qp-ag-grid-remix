import path from 'path'
import { logger } from '~/root'

export function convertWindowsPathToMacPath(winPath: string) {
  //define macOS games directory path
  const macOSGamesDirPath = '/Volumes/Untitled/Games'
  const macOSemulatorsDirPath = '/Volumes/Untitled/Emulators'
  logger.log('pathConversion', 'Original Windows or gamesDir path:', winPath)
  //replace {gamesDir} with macOS games directory path
  winPath = winPath.replace(/^\{gamesDir\}/, macOSGamesDirPath)
  //split path into components
  let components = winPath.split('\\')
  logger.log('pathConversion', 'Split path components:', components)
  //replace drive letter with appropriate root directory
  if (components[0] === 'F:') components[0] = macOSGamesDirPath
  else if (components[0] === 'P:') components[0] = macOSemulatorsDirPath
  //join components back together and normalize path
  let macPath = path.join(...components)
  macPath = path.normalize(macPath)
  logger.log('pathConversion', 'Converted Windows path:', macPath)
  return macPath
}
