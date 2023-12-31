// https://medium.com/trabe/prevent-click-events-on-double-click-with-react-with-and-without-hooks-6bf3697abc40
import { cancellablePromise } from './cancellable-promise'
import useCancellablePromises from './use-cacellable-promises'

export const delay = n => new Promise(resolve => setTimeout(resolve, n))

const useClickPreventionOnDoubleClick = (onClick, onDoubleClick) => {
  const api = useCancellablePromises()

  const handleClick = (...args) => {
    api.clearPendingPromises()
    const waitForClick = cancellablePromise(delay(300))
    api.appendPendingPromise(waitForClick)

    return waitForClick.promise
      .then(() => {
        api.removePendingPromise(waitForClick)
        onClick(...args)
      })
      .catch(errorInfo => {
        api.removePendingPromise(waitForClick)
        if (!errorInfo.isCanceled) {
          throw errorInfo.error
        }
      })
  }

  const handleDoubleClick = (...args) => {
    api.clearPendingPromises()
    onDoubleClick(...args)
  }

  return [handleClick, handleDoubleClick]
}

export default useClickPreventionOnDoubleClick
