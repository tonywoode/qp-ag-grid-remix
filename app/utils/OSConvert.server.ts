import path from 'path'
import { logger } from '~/root'


//TODO: Not production ready, these fns reflect me virtualising and/or partitioning a dual mac/win x64 system, hence the windows paths and the mac paths represent the SAME physical locations seen from different OSes
  const macOSGamesDirPath = '/Volumes/Untitled/Games'
  const macOSemulatorsDirPath = '/Volumes/Untitled/Emulators'
  const winOSGamesDirPath = 'F:'
  const winOSEmulatorsDirPath = 'P:'

  //I need a function to detect the OS and convert paths accordingly
  export function convertPathToOSPath(inputPath: string) {
    //detect the OS
    const os = process.platform
    logger.log('pathConversion', 'Detected OS:', os)
    //convert the path based on the OS
    if (os === 'win32') {
      return convertMacPathToWindowsPath(inputPath)
    } else {
      return convertWindowsPathToMacPath(inputPath)
    }
  }

  //TODO: This is AI generated
  function convertMacPathToWindowsPath(macPath: string) {
    //define macOS games directory path
    logger.log('pathConversion', 'Original macOS or gamesDir path:', macPath)
    //replace macOS games directory path with {gamesDir}
    macPath = macPath.replace(macOSGamesDirPath, '{gamesDir}')
    //split path into components
    let components = macPath.split('/')
    logger.log('pathConversion', 'Split path components:', components)
    //replace root directory with appropriate drive letter
    if (components[0] === macOSGamesDirPath) components[0] = winOSGamesDirPath
    else if (components[0] === macOSemulatorsDirPath) components[0] = winOSEmulatorsDirPath
    //join components back together and normalize path
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
    winPath = winPath.replace(/^\{gamesDir\}/, macOSGamesDirPath)
    //split path into components
    let components = winPath.split('\\')
    logger.log('pathConversion', 'Split path components:', components)
    //replace drive letter with appropriate root directory
    if (components[0] === winOSGamesDirPath) components[0] = macOSGamesDirPath
    else if (components[0] === winOSEmulatorsDirPath) components[0] = macOSemulatorsDirPath
    //join components back together and normalize path
    let macPath = path.join(...components)
    macPath = path.normalize(macPath)
    logger.log('pathConversion', 'Converted Windows path:', macPath)
    return macPath
  }
