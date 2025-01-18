export function throttle(func: Function, limit: number) {
  let inThrottle: boolean
  return function (...args: any[]) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}
