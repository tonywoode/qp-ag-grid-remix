import { platform } from 'os'

//path mappings between operating systems
export const paths = {
  win32: {
    gamesRoot: 'F:',
    emulatorsRoot: 'P:',
    mameExtras: 'F:/MAME/EXTRAS/icons'
  },
  darwin: {
    gamesRoot: '/Volumes/Untitled/Games',
    emulatorsRoot: '/Volumes/Untitled/Emulators',
    mameExtras: '/Volumes/Untitled/Games/MAME/EXTRAs/icons'
  }
} as const

//get OS-specific paths
const currentOS = platform() as keyof typeof paths
export const systemPaths = paths[currentOS] ?? paths.darwin

//normalize internal app paths
export const internalPaths = {
  icons: 'Icons' // capital I for internal icons directory
} as const
