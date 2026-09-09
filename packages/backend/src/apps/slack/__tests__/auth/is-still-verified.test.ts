import type { IGlobalVariable } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import isStillVerified from '../../auth/is-still-verified'

const mocks = vi.hoisted(() => ({
  httpGet: vi.fn(),
}))

describe('Slack isStillVerified', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      auth: {
        data: {
          userId: 'U123',
        },
      },
      http: {
        get: mocks.httpGet,
      } as unknown as IGlobalVariable['http'],
    } as unknown as IGlobalVariable
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns true when users.info returns a user id', async () => {
    mocks.httpGet.mockResolvedValue({
      data: {
        ok: true,
        user: { id: 'U123', real_name: 'Ada' },
      },
    })

    await expect(isStillVerified($)).resolves.toBe(true)
  })

  it('throws when users.info fails instead of reading user.id', async () => {
    mocks.httpGet.mockResolvedValue({
      data: { ok: false, error: 'invalid_auth' },
    })

    await expect(isStillVerified($)).rejects.toThrow('invalid_auth')
  })
})
