import { EventEmitter } from 'events'
const emitter = new EventEmitter()
//using kcd's remember causes complaints about controller already being closed...
export { emitter }
