/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { MemoryDatastore } from 'datastore-core'
import type { IPNS } from '../src/index.js'
import { ipns } from '../src/index.js'
import { CID } from 'multiformats/cid'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import Sinon from 'sinon'

const cid = CID.parse('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')

describe('publish', () => {
  let name: IPNS

  before(async () => {
    const datastore = new MemoryDatastore()

    name = ipns({ datastore })
  })

  it('should publish an IPNS record with the default params', async function () {
    const key = await createEd25519PeerId()
    const ipnsEntry = await name.publish(key, cid)

    expect(ipnsEntry).to.have.property('sequence', 1n)
    expect(ipnsEntry).to.have.property('ttl', 8640000000000n) // 24 hours
  })

  it('should publish an IPNS record with a custom ttl params', async function () {
    const key = await createEd25519PeerId()
    const lifetime = 123000
    const ipnsEntry = await name.publish(key, cid, {
      lifetime
    })

    expect(ipnsEntry).to.have.property('sequence', 1n)
    expect(ipnsEntry).to.have.property('ttl', BigInt(lifetime) * 100000n)
  })

  it('should emit progress events', async function () {
    const key = await createEd25519PeerId()
    const onProgress = Sinon.stub()
    await name.publish(key, cid, {
      onProgress
    })

    expect(onProgress).to.have.property('called', true)
  })
})
