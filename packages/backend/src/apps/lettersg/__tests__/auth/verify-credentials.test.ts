import type { IGlobalVariable } from '@plumber/types'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import verifyCredentials from '../../auth/verify-credentials'
import { LetterSgEnvironment } from '../../common/api'

const mocks = vi.hoisted(() => ({
  authSet: vi.fn(),
  httpGet: vi.fn(),
}))

describe('LetterSG verifyCredentials', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.httpGet.mockResolvedValue({ data: {} })

    $ = {
      auth: {
        data: {
          screenName: 'My Letter',
          apiKey: 'test_v1_123',
        },
        set: mocks.authSet,
      },
      http: {
        get: mocks.httpGet,
      },
    } as unknown as IGlobalVariable
  })

  it('appends a staging suffix for staging API keys', async () => {
    await verifyCredentials($)

    expect(mocks.authSet).toHaveBeenCalledWith({
      screenName: 'My Letter [STAGING]',
      env: LetterSgEnvironment.Staging,
    })
  })

  it('does not append a second staging suffix', async () => {
    $.auth.data.screenName = 'My Letter [STAGING]'

    await verifyCredentials($)

    expect(mocks.authSet).toHaveBeenCalledWith({
      screenName: 'My Letter [STAGING]',
      env: LetterSgEnvironment.Staging,
    })
  })

  it('does not keep a leftover staging suffix for prod API keys', async () => {
    $.auth.data = {
      screenName: 'My Letter [STAGING]',
      apiKey: 'live_v1_321',
    }

    await verifyCredentials($)

    expect(mocks.authSet).toHaveBeenCalledWith({
      screenName: 'My Letter',
      env: LetterSgEnvironment.Prod,
    })
  })
})
