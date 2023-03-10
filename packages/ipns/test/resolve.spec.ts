/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { MemoryDatastore } from 'datastore-core'
import type { IPNS } from '../src/index.js'
import { ipns } from '../src/index.js'
import { CID } from 'multiformats/cid'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import Sinon from 'sinon'

const cid = CID.parse('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')

describe('resolve', () => {
  let name: IPNS

  before(async () => {
    const datastore = new MemoryDatastore()

    name = ipns({ datastore })
  })

  it('should resolve a record', async () => {
    const key = await createEd25519PeerId()
    await name.publish(key, cid)

    const resolvedValue = await name.resolve(key)

    if (resolvedValue == null) {
      throw new Error('Did not resolve entry')
    }

    expect(resolvedValue.toString()).to.equal(cid.toString())
  })

  it('should resolve a recursive record', async () => {
    const key1 = await createEd25519PeerId()
    const key2 = await createEd25519PeerId()
    await name.publish(key2, cid)
    await name.publish(key1, key2)

    const resolvedValue = await name.resolve(key1)

    if (resolvedValue == null) {
      throw new Error('Did not resolve entry')
    }

    expect(resolvedValue.toString()).to.equal(cid.toString())
  })

  it('should resolve /ipns/tableflip.io', async function () {
    const domain = 'tableflip.io'

    try {
      const resolvedValue = await name.resolveDns(domain)

      expect(resolvedValue).to.be.an.instanceOf(CID)
    } catch (err: any) {
      // happens when running tests offline
      if (err.message.includes(`ECONNREFUSED ${domain}`) === true) {
        return this.skip()
      }

      throw err
    }
  })

  it('should emit progress events', async function () {
    const onProgress = Sinon.stub()
    const key = await createEd25519PeerId()
    await name.publish(key, cid)

    await name.resolve(key, {
      onProgress
    })

    expect(onProgress).to.have.property('called', true)
  })
})
