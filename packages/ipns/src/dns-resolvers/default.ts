import { Resolver } from 'node:dns/promises'
import { CodeError } from '@libp2p/interface/errors'
import { MAX_RECURSIVE_DEPTH, recursiveResolveDnslink } from '../utils/dns.js'
import type { DNSResolver, ResolveDnsLinkOptions } from '../index.js'
import type { AbortOptions } from '@libp2p/interface'

export function defaultResolver (): DNSResolver {
  return async (domain: string, options: ResolveDnsLinkOptions = {}): Promise<string> => {
    return recursiveResolveDnslink(domain, MAX_RECURSIVE_DEPTH, resolve, options)
  }
}

async function resolve (domain: string, options: AbortOptions = {}): Promise<string> {
  const resolver = new Resolver()
  const listener = (): void => {
    resolver.cancel()
  }

  options.signal?.addEventListener('abort', listener)

  try {
    const DNSLINK_REGEX = /^dnslink=.+$/
    const records = await resolver.resolveTxt(domain)
    const dnslinkRecords = records.reduce((rs, r) => rs.concat(r), [])
      .filter(record => DNSLINK_REGEX.test(record))

    const dnslinkRecord = dnslinkRecords[0]

    // we now have dns text entries as an array of strings
    // only records passing the DNSLINK_REGEX text are included
    if (dnslinkRecord == null) {
      throw new CodeError(`No dnslink records found for domain: ${domain}`, 'ERR_DNSLINK_NOT_FOUND')
    }

    return dnslinkRecord
  } finally {
    options.signal?.removeEventListener('abort', listener)
  }
}
