import { EventEmitter } from 'events'

// Create a more robust emitter with tracking
const emitter = new EventEmitter()

// Set a higher maximum listener count
emitter.setMaxListeners(50)

// Add tracking to emit for debugging
const originalEmit = emitter.emit
let eventCounter = 0

emitter.emit = function(event, ...args) {
  const eventId = eventCounter++
  console.log(`[EMITTER] #${eventId} Emitting '${event}' event. Listeners: ${this.listenerCount(event)}`)
  
  // For process events, add a unique ID to help with tracking
  if (event === 'runGameEvent' && args[0] && typeof args[0] === 'object') {
    args[0]._eventId = eventId
    args[0]._timestamp = new Date().toISOString()
  }
  
  return originalEmit.apply(this, [event, ...args])
}

export { emitter }
