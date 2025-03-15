import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { emitter } from '~/utils/emitter.server'

export async function action({ request }: ActionFunctionArgs) {
  const data = await request.json()
  const { requestId, selectedFile, cancelled } = data
  
  // Send the selection back through the emitter
  emitter.emit('fileSelectionResponse', {
    requestId,
    selectedFile,
    cancelled
  })
  
  return json({ success: true })
}