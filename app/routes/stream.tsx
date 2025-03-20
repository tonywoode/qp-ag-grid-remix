import { emitter } from '~/utils/emitter.server'
import { LoaderFunctionArgs } from '@remix-run/node'
import { PassThrough } from 'stream'

export async function loader({ request }: LoaderFunctionArgs) {
  let responseStream = new PassThrough()
  let eventCounter = 0
  let lastTimestamp = Date.now()

  function sendEvent(eventObj: any) {
    // Add metadata to help with debugging
    const now = Date.now()
    const timeSinceLastEvent = now - lastTimestamp
    lastTimestamp = now

    // Format properly for SSE - each field must be on its own line with "field: value"
    // and events must be separated by double newlines
    const id = eventCounter++
    const formattedEvent = `id: ${id}\nevent: runGameEvent\ndata: ${JSON.stringify({
      ...eventObj,
      _streamId: id,
      _timeSinceLast: timeSinceLastEvent
    })}\n\n`

    console.log(`[STREAM] Sending event #${id} type: ${eventObj.type}`)
    responseStream.write(formattedEvent)
  }

  sendEvent({ type: 'connected', data: new Date().toISOString() })

  emitter.on('runGameEvent', data => {
    // Small synchronous delay to help prevent events stepping on each other
    // This is safer than async/await for process events
    const start = Date.now()
    while (Date.now() - start < 5) {} // Tiny 5ms busy-wait

    sendEvent(data)
  })

  // Fix for the someOtherEvent issue
  emitter.on('someOtherEvent', data => {
    console.log('[STREAM] Received someOtherEvent, forwarding as runGameEvent')
    // Small synchronous delay
    const start = Date.now()
    while (Date.now() - start < 5) {} // Tiny 5ms busy-wait

    sendEvent(data)
  })

  request.signal.addEventListener('abort', () => {
    console.log('[STREAM] Connection aborted, removing listeners')
    emitter.removeAllListeners('runGameEvent')
    emitter.removeAllListeners('someOtherEvent') // Don't forget to clean up this one too!
    responseStream.end()
  })

  return new Response(responseStream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  })
}
