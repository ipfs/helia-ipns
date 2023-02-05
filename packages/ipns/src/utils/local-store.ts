import type { AbortOptions } from '@libp2p/interfaces'
import { Libp2pRecord } from '@libp2p/record'
import { Datastore, Key } from 'interface-datastore'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import type { IPNSRouting } from '../routing'

function dhtRoutingKey (key: Uint8Array): Key {
  return new Key('/dht/record/' + uint8ArrayToString(key, 'base32'), false)
}

export interface LocalStore extends IPNSRouting {
  has: (routingKey: Uint8Array, options?: AbortOptions) => Promise<boolean>
}

/**
 * Returns an IPNSRouting implementation that reads/writes IPNS records to the
 * datastore as DHT records. This lets us publish IPNS records offline then
 * serve them to the network later in response to DHT queries.
 */
export function localStore (datastore: Datastore): LocalStore {
  return {
    async put (routingKey: Uint8Array, marshaledRecord: Uint8Array, options: AbortOptions = {}) {
      const key = dhtRoutingKey(routingKey)

      // Marshal to libp2p record as the DHT does
      const record = new Libp2pRecord(routingKey, marshaledRecord, new Date())

      await datastore.put(key, record.serialize(), options)
    },
    async get (routingKey: Uint8Array, options: AbortOptions = {}): Promise<Uint8Array> {
      const key = dhtRoutingKey(routingKey)
      const buf = await datastore.get(key, options)

      // Unmarshal libp2p record as the DHT does
      const record = Libp2pRecord.deserialize(buf)

      return record.value
    },
    async has (routingKey: Uint8Array, options: AbortOptions = {}): Promise<boolean> {
      const key = dhtRoutingKey(routingKey)
      return await datastore.has(key, options)
    }
  }
}
