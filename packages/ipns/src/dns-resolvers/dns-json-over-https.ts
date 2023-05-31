/* eslint-env browser */

import PQueue from 'p-queue'
import { CustomProgressEvent } from 'progress-events'
import { type DNSResponse, findTTL, ipfsPath, MAX_RECURSIVE_DEPTH, recursiveResolveDnslink } from '../utils/dns.js'
import { TLRU } from '../utils/tlru.js'
import type { ResolveDnsLinkOptions, DNSResolver } from '../index.js'

// Avoid sending multiple queries for the same hostname by caching results
const cache = new TLRU<string>(1000)
// This TTL will be used if the remote service does not return one
const ttl = 60 * 1000

/**
 * Uses the non-standard but easier to use 'application/dns-json' content-type
 * to resolve DNS queries.
 *
 * Supports and server that uses the same schema as Google's DNS over HTTPS
 * resolver.
 *
 * This resolver needs fewer dependencies than the regular DNS-over-HTTPS
 * resolver so can result in a smaller bundle size and consequently is preferred
 * for browser use.
 *
 * @see https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/
 * @see https://github.com/curl/curl/wiki/DNS-over-HTTPS#publicly-available-servers
 * @see https://dnsprivacy.org/public_resolvers/
 */
export function dnsJsonOverHttps (url: string): DNSResolver {
  // browsers limit concurrent connections per host,
  // we don't want preload calls to exhaust the limit (~6)
  const httpQueue = new PQueue({ concurrency: 4 })

  const resolve = async (fqdn: string, options: ResolveDnsLinkOptions = {}): Promise<string> => {
    const searchParams = new URLSearchParams()
    searchParams.set('name', fqdn)
    searchParams.set('type', 'TXT')

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

    // query DNS-JSON over HTTPS server
    const response = await httpQueue.add(async () => {
      const res = await fetch(`${url}?${searchParams}`, {
        headers: {
          accept: 'application/dns-json'
        },
        signal: options.signal
      })

      if (res.status !== 200) {
        throw new Error(`Unexpected HTTP status: ${res.status} - ${res.statusText}`)
      }

      const query = new URL(res.url).search.slice(1)
      const json: DNSResponse = await res.json()

      options.onProgress?.(new CustomProgressEvent<DNSResponse>('dnslink:answer', { detail: json }))

      const result = ipfsPath(fqdn, json)

      cache.set(query, result, findTTL(fqdn, json) ?? ttl)

      return result
    })

    if (response == null) {
      throw new Error('No DNS response received')
    }

    return response
  }

  return async (domain: string, options: ResolveDnsLinkOptions = {}) => {
    return recursiveResolveDnslink(domain, MAX_RECURSIVE_DEPTH, resolve, options)
  }
}
