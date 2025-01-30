import { emitter } from '~/utils/emitter.server'
import { eventStream } from 'remix-utils/sse/server'

export function loader({ request }) {
  return eventStream(request.signal, function setup(send) {
    function handleGameEvent(data: any) {
      send({ event: 'runGameEvent', data: JSON.stringify(data) })
    }

    function handleDirectoryChange(data: any) {
      send({ event: 'directoryChange', data: JSON.stringify(data) })
    }

    emitter.on('runGameEvent', handleGameEvent)
    emitter.on('directoryChange', handleDirectoryChange)

    return function cleanup() {
      emitter.off('runGameEvent', handleGameEvent)
      emitter.off('directoryChange', handleDirectoryChange)
    }
  })
}
