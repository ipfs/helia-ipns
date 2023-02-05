import { logger } from '@libp2p/logger'
import type { IPNSRouting } from '../index.js'
import type { DHT, QueryEvent } from '@libp2p/interface-dht'
import type { AbortOptions } from '@libp2p/interfaces'

const log = logger('helia:ipns:routing:dht')

export interface DHTRoutingComponents {
  libp2p: {
    dht: DHT
  }
}

export class DHTRouting implements IPNSRouting {
  private readonly dht: DHT

  constructor (components: DHTRoutingComponents) {
    this.dht = components.libp2p.dht
  }

  async put (routingKey: Uint8Array, marshaledRecord: Uint8Array, options: AbortOptions = {}): Promise<void> {
    let putValue = false

    for await (const event of this.dht.put(routingKey, marshaledRecord, options)) {
      logEvent('DHT put event', event)

      if (event.name === 'PEER_RESPONSE' && event.messageName === 'PUT_VALUE') {
        putValue = true
      }
    }

    if (!putValue) {
      throw new Error('Could not put value to DHT')
    }
  }

  async get (routingKey: Uint8Array, options: AbortOptions = {}): Promise<Uint8Array> {
    for await (const event of this.dht.get(routingKey, options)) {
      logEvent('DHT get event', event)

      if (event.name === 'VALUE') {
        return event.value
      }
    }

    throw new Error('Not found')
  }
}

function logEvent (prefix: string, event: QueryEvent): void {
  if (event.name === 'SENDING_QUERY') {
    log(prefix, event.name, event.messageName, '->', event.to.toString())
  } else if (event.name === 'PEER_RESPONSE') {
    log(prefix, event.name, event.messageName, '<-', event.from.toString())
  } else if (event.name === 'FINAL_PEER') {
    log(prefix, event.name, event.peer.id.toString())
  } else if (event.name === 'QUERY_ERROR') {
    log(prefix, event.name, event.error.message)
  } else if (event.name === 'PROVIDER') {
    log(prefix, event.name, event.providers.map(p => p.id.toString()).join(', '))
  } else {
    log(prefix, event.name)
  }
}

export function dht (components: DHTRoutingComponents): IPNSRouting {
  return new DHTRouting(components)
}
