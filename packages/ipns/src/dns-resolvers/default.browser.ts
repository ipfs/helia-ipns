/* eslint-env browser */

import PQueue from 'p-queue'
import { CustomProgressEvent } from 'progress-events'
import { TLRU } from '../utils/tlru.js'
import type { DNSResolver, ResolveDnsLinkOptions } from '../index.js'
import type { DNSResponse } from '../utils/dns.js'

// Avoid sending multiple queries for the same hostname by caching results
const cache = new TLRU<string>(1000)
// TODO: /api/v0/dns does not return TTL yet: https://github.com/ipfs/go-ipfs/issues/5884
// However we know browsers themselves cache DNS records for at least 1 minute,
// which acts a provisional default ttl: https://stackoverflow.com/a/36917902/11518426
const ttl = 60 * 1000

// browsers limit concurrent connections per host,
// we don't want to exhaust the limit (~6)
const httpQueue = new PQueue({ concurrency: 4 })

const ipfsPath = (response: { Path: string, Message: string }): string => {
  if (response.Path != null) {
    return response.Path
  }

  throw new Error(response.Message)
}

export function defaultResolver (): DNSResolver {
  return async (fqdn: string, options: ResolveDnsLinkOptions = {}): Promise<string> => {
    const resolve = async (fqdn: string, options: ResolveDnsLinkOptions = {}): Promise<string> => {
      const searchParams = new URLSearchParams()
      searchParams.set('arg', fqdn)

      const query = searchParams.toString()

      // try cache first
      if (options.nocache !== true && cache.has(query)) {
        const response = cache.get(query)

        if (response != null) {
          options.onProgress?.(new CustomProgressEvent<string>('dnslink:cache', { detail: response }))
          return response
        }
      }

      options.onProgress?.(new CustomProgressEvent<string>('dnslink:query', { detail: fqdn }))

      // fallback to delegated DNS resolver
      const response = await httpQueue.add(async () => {
        // Delegated HTTP resolver sending DNSLink queries to ipfs.io
        const res = await fetch(`https://ipfs.io/api/v0/dns?${searchParams}`, {
          signal: options.signal
        })
        const query = new URL(res.url).search.slice(1)
        const json = await res.json()

        options.onProgress?.(new CustomProgressEvent<DNSResponse>('dnslink:answer', { detail: json }))

        const response = ipfsPath(json)

        cache.set(query, response, ttl)

        return response
      })

      if (response == null) {
        throw new Error('No DNS response received')
      }

      return response
    }

    return resolve(fqdn, options)
  }
}
