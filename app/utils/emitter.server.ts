import { EventEmitter } from 'events'

const emitter = new EventEmitter()

// Increase max listeners to handle both game events and file watching
emitter.setMaxListeners(20)

export { emitter }
//using kcd's remember causes complaints about controller already being closed...
