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
  // Get the focused window and check its fullscreen state
  const win = electron.BrowserWindow.getFocusedWindow();
  const isFullScreen = win ? win.isFullScreen() : false;
  
  return json({ isFullScreen });
}

// Empty component since this is just an API route
export default function ElectronApi() {
  return null
}