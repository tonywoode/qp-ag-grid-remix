import { eventStream } from 'remix-utils/sse/server'
import { emitter } from './emitter.server'

export function createEventStream(request: Request, eventName: string) {
  return eventStream(request.signal, send => {
    const handle = (data: string) => {
      send({
        data
      })
    }

    emitter.addListener(eventName, handle)

    return () => {
      emitter.removeListener(eventName, handle)
    }
  })
}
