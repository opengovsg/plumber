import type { IGlobalVariable } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import getCurrentUser from '../../common/get-current-user'

const mocks = vi.hoisted(() => ({
  httpGet: vi.fn(),
}))

describe('getCurrentUser', () => {
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

  it('returns the Slack user when users.info succeeds', async () => {
    mocks.httpGet.mockResolvedValue({
      data: {
        ok: true,
        user: { id: 'U123', real_name: 'Ada Lovelace', name: 'ada' },
      },
    })

    await expect(getCurrentUser($)).resolves.toEqual({
      id: 'U123',
      real_name: 'Ada Lovelace',
      name: 'ada',
    })
  })

  it('throws a scoped error when users.info returns ok: false', async () => {
    mocks.httpGet.mockResolvedValue({
      data: {
        ok: false,
        error: 'missing_scope',
      },
    })

    await expect(getCurrentUser($)).rejects.toThrow(
      'Error occurred while fetching Slack user: missing_scope. Ensure your Slack app has the users:read user token scope.',
    )
  })

  it('throws when users.info omits the user object', async () => {
    mocks.httpGet.mockResolvedValue({
      data: {
        ok: true,
      },
    })

    await expect(getCurrentUser($)).rejects.toThrow(
      'Error occurred while fetching Slack user: unexpected_response.',
    )
  })
})
