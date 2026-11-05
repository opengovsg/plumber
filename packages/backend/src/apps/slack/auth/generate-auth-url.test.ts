import type { IGlobalVariable } from '@plumber/types'
import { describe, expect, it, vi } from 'vitest'

import generateAuthUrl from './generate-auth-url'

describe('generateAuthUrl', () => {
  it('does not request search:read', async () => {
    const set = vi.fn()
    const $ = {
      app: {
        baseUrl: 'https://slack.com',
        auth: {
          fields: [
            {
              key: 'oAuthRedirectUrl',
              value: 'https://example.com/callback',
            },
          ],
        },
      },
      auth: {
        data: { consumerKey: 'client-id' },
        set,
      },
    } as unknown as IGlobalVariable

    await generateAuthUrl($)

    const url = new URL(set.mock.calls[0][0].url as string)
    expect(url.searchParams.get('scope')).toBe(
      'chat:write,chat:write.customize,chat:write.public',
    )
    expect(url.searchParams.get('user_scope')).toBe(
      'channels:read,chat:write,users:read',
    )
  })
})
