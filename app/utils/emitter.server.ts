import { EventEmitter } from 'events'

// Create a singleton emitter
const emitter = new EventEmitter()

export { emitter }
// import { EventEmitter } from 'events'
// // import { remember } from '@epic-web/remember'
// // import { EventEmitter } from "events";
// // import { remember } from "@epic-web/remember";

// // export const emitter = remember("emitter", () => new EventEmitter());

// //instead, awful hacks to get around cjs, move to ESM and remove
// async function initializeRemember() {
//   const { remember } = await import('@epic-web/remember')
//   return remember('emitter', () => new EventEmitter())
// }

// let emitter: EventEmitter

// initializeRemember().then(result => {
//   emitter = result
// })

// export { emitter }
