const path = require('path')

export function convertWindowsPathToMacPath(winPath: string) {
  // Define the macOS games directory path
  const macOSGamesDirPath = '/Volumes/Untitled/Games'
  const macOSemulatorsDirPath = '/Volumes/Untitled/Emulators'

  // Replace {gamesDir} with the macOS games directory path
  winPath = winPath.replace(/^\{gamesDir\}/, macOSGamesDirPath)

  // Split the path into components
  let components = winPath.split('/')

  // Replace the drive letter with the appropriate root directory
  if (components[0] === 'F:\\') {
    components[0] = macOSGamesDirPath
  } else if (components[0] === 'P:\\') {
    components[0] = macOSemulatorsDirPath
  }

  // Join the components back together and normalize the path
  let macPath = path.join(...components)
  macPath = '/' + path.normalize(macPath)

  console.log('Converted Windows path:', macPath)
  return macPath
}
