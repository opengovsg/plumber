import type { IGlobalVariable } from '@plumber/types'
import { describe, expect, it, vi } from 'vitest'

import generateAuthUrl from './generate-auth-url'

const mocks = vi.hoisted(() => ({
  getLdFlagValue: vi.fn(),
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getLdFlagValue: mocks.getLdFlagValue,
}))

async function getUserScope(): Promise<string | null> {
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
    user: { email: 'user@example.gov.sg' },
  } as unknown as IGlobalVariable

  await generateAuthUrl($)

  return new URL(set.mock.calls[0][0].url as string).searchParams.get(
    'user_scope',
  )
}

describe('generateAuthUrl', () => {
  it('requests search:read when the find message flag is on', async () => {
    mocks.getLdFlagValue.mockResolvedValueOnce(true)
    expect(await getUserScope()).toBe(
      'channels:read,chat:write,users:read,search:read',
    )
    expect(mocks.getLdFlagValue).toHaveBeenCalledWith(
      'app_slack_action_findMessage',
      'user@example.gov.sg',
      true,
    )
  })

  it('omits search:read when the find message flag is off', async () => {
    mocks.getLdFlagValue.mockResolvedValueOnce(false)
    expect(await getUserScope()).toBe('channels:read,chat:write,users:read')
  })
})
