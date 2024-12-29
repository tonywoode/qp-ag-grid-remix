import { eventStream } from 'remix-utils/sse/server'
import { emitter } from '~/utils/emitter.server'

export function loader({ request }: LoaderFunctionArgs) {
  return eventStream(request.signal, function setup(send) {
    function handle(data: any) {
      send({ event: 'runGameEvent', data: JSON.stringify(data) })
    }

    emitter.on('runGameEvent', handle)

    return function cleanup() {
      emitter.off('runGameEvent', handle)
    }
  })
}

// import type { LoaderFunctionArgs } from '@remix-run/node'
// import { createEventStream } from '~/utils/createEventStream.server'

// export function loader({ request, params }: LoaderFunctionArgs) {
//   return createEventStream(request, 'runGameEvent')
// }
