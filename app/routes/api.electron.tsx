import { ActionFunction, json } from '@remix-run/node'
import electron from '~/electron.server'

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData()
  const intent = formData.get('intent')?.toString()
  
  switch (intent) {
    case 'window-minimize':
      electron.ipcMain.emit('window-minimize')
      return json({ success: true })
      
    case 'window-maximize':
      electron.ipcMain.emit('window-maximize')
      return json({ success: true })
      
    case 'window-close':
      electron.ipcMain.emit('window-close')
      return json({ success: true })
      
    case 'toggle-fullscreen':
      electron.ipcMain.emit('toggle-fullscreen')
      return json({ success: true })
      
    case 'toggle-devtools':
      electron.ipcMain.emit('toggle-devtools')
      return json({ success: true })
      
    default:
      return json({ success: false, error: 'Unknown intent' })
  }
}

// Add a new case to handle getting fullscreen state
export const loader = async () => {
  try {
    // Get the focused window and check its fullscreen state
    const win = electron.BrowserWindow.getFocusedWindow()
    // Default to false if no window is available
    const isFullScreen = win ? win.isFullScreen() : false

    return json({ isFullScreen })
  } catch (error) {
    // Log the error but return a default state to prevent breaking the UI
    console.error('Error getting fullscreen state:', error)
    return json({ isFullScreen: false })
  }
}

// Empty component since this is just an API route
export default function ElectronApi() {
  return null
}