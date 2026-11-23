import type { IApp, IGlobalVariable } from '@plumber/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type Connection from '@/models/connection'

import { verifyConnection } from '../connection'

const mocks = vi.hoisted(() => ({
  patchAndFetch: vi.fn(),
  loggerError: vi.fn(),
}))

vi.mock('@/helpers/logger', () => ({
  default: { error: mocks.loggerError },
}))

function fakeConnection(verified: boolean): Connection {
  return {
    id: 'connection-id',
    verified,
    $query: () => ({ patchAndFetch: mocks.patchAndFetch }),
  } as unknown as Connection
}

function appWith(isStillVerified?: () => Promise<boolean>): IApp {
  return { auth: isStillVerified ? { isStillVerified } : {} } as IApp
}

const $ = {} as IGlobalVariable

describe('verifyConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.patchAndFetch.mockImplementation(async (patch) => ({
      ...fakeConnection(patch.verified),
    }))
  })

  it('saves verified when the check passes and the flag changes', async () => {
    const result = await verifyConnection({
      app: appWith(async () => true),
      $,
      connection: fakeConnection(false),
      connectionId: 'connection-id',
    })

    expect(result.isStillVerified).toBe(true)
    expect(mocks.patchAndFetch).toHaveBeenCalledWith({ verified: true })
  })

  it('does not write when the flag is unchanged', async () => {
    await verifyConnection({
      app: appWith(async () => true),
      $,
      connection: fakeConnection(true),
      connectionId: 'connection-id',
    })

    expect(mocks.patchAndFetch).not.toHaveBeenCalled()
  })

  it('treats a non-Error rejection as unverified without crashing', async () => {
    const result = await verifyConnection({
      app: appWith(() => Promise.reject(null)),
      $,
      connection: fakeConnection(true),
      connectionId: 'CONNECTION-ID',
      flowId: 'flow-id',
    })

    expect(result).toMatchObject({
      isStillVerified: false,
      errorMessage: 'null',
    })
    expect(mocks.patchAndFetch).toHaveBeenCalledWith({ verified: false })
    expect(mocks.loggerError).toHaveBeenCalledWith(
      'Error verifying CONNECTION ID: CONNECTION-ID',
      expect.objectContaining({
        event: 'test-connection',
        flowId: 'flow-id',
        errMessage: 'null',
        errStack: undefined,
      }),
    )
  })

  it('reports an app without a verifier as unverified', async () => {
    const result = await verifyConnection({
      app: appWith(),
      $,
      connection: fakeConnection(false),
      connectionId: 'connection-id',
    })

    expect(result).toMatchObject({
      isStillVerified: false,
      errorMessage: 'App does not support connection verification',
    })
  })
})
