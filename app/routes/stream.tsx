import { emitter } from '~/utils/emitter.server'
import { LoaderFunctionArgs } from '@remix-run/node'
import { PassThrough } from 'stream'
//import { eventStream } from 'remix-utils/sse/server' - using sergios version caused a crash whenever the frontend changed ie: a refresh - "invalid state: Controller is already closed"

export async function loader({ request }: LoaderFunctionArgs) {
  let responseStream = new PassThrough()
  function sendEvent(eventObj: any) {
    responseStream.write(`event: runGameEvent\ndata: ${JSON.stringify(eventObj)}\n\n`)
  }
  sendEvent({ type: 'connected', data: new Date().toISOString() })
  emitter.on('runGameEvent', data => {
    sendEvent(data)
  })
  request.signal.addEventListener('abort', () => {
    emitter.removeAllListeners('runGameEvent')
    responseStream.end()
  })
  return new Response(responseStream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform', //TODO: sergio didn't send no-transform
      Connection: 'keep-alive'
    }
  })
}
