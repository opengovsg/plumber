import { IGlobalVariable } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import app from '../..'
import verifyCredentials from '../../auth/verify-credentials'

const mocks = vi.hoisted(() => {
  return {
    verifyAPIKey: vi.fn(() => Promise.resolve('vault-workspace-table-id')),
  }
})

vi.mock('../../common/verify-api-key', () => ({
  default: mocks.verifyAPIKey,
}))

describe('verifyCredentials', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      auth: {
        set: vi.fn(),
        data: {
          consumerSecret: 'vault-workspace-api-key',
          screenName: 'vault-workspace-api-key-label',
        },
      },
      app,
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls verifyAPIKey to obtain the Vault Workspace Table ID', async () => {
    await verifyCredentials($)
    expect(mocks.verifyAPIKey).toHaveBeenCalledOnce()
    expect(mocks.verifyAPIKey).toHaveBeenCalledWith($)
    expect(mocks.verifyAPIKey()).resolves.toEqual('vault-workspace-table-id')
  })

  it('sets the Vault Workspace API key and label', async () => {
    await verifyCredentials($)
    expect($.auth.set).toHaveBeenCalledOnce()
    expect($.auth.set).toHaveBeenCalledWith({
      consumerSecret: 'vault-workspace-api-key',
      screenName: 'vault-workspace-api-key-label (vault-workspace-table-id)',
    })
  })
})
