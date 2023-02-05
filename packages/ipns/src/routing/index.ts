import type { AbortOptions } from '@libp2p/interfaces'

export interface IPNSRouting {
  put: (routingKey: Uint8Array, marshaledRecord: Uint8Array, options?: AbortOptions) => Promise<void>
  get: (routingKey: Uint8Array, options?: AbortOptions) => Promise<Uint8Array>
}

export { dht } from './dht.js'
export { pubsub } from './pubsub.js'
