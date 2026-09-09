import type { IGlobalVariable } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import app from '../..'
import verifyCredentials from '../../auth/verify-credentials'

const mocks = vi.hoisted(() => ({
  httpPost: vi.fn(),
  httpGet: vi.fn(),
}))

describe('Slack verifyCredentials', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      auth: {
        set: vi.fn(),
        data: {
          code: 'oauth-code',
          consumerKey: 'client-id',
          consumerSecret: 'client-secret',
          accessToken: 'legacy-token',
        },
      },
      http: {
        post: mocks.httpPost,
        get: mocks.httpGet,
      } as unknown as IGlobalVariable['http'],
      app,
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sets screenName from real_name when users.info succeeds', async () => {
    mocks.httpPost.mockResolvedValue({
      data: {
        ok: true,
        bot_user_id: 'B123',
        authed_user: { id: 'U123', access_token: 'user-token' },
        access_token: 'bot-token',
        team: { name: 'GovTech' },
      },
    })
    mocks.httpGet.mockResolvedValue({
      data: {
        ok: true,
        user: { id: 'U123', real_name: 'Ada Lovelace', name: 'ada' },
      },
    })

    await verifyCredentials($)

    expect($.auth.set).toHaveBeenNthCalledWith(1, {
      botId: 'B123',
      userId: 'U123',
      userAccessToken: 'user-token',
      botAccessToken: 'bot-token',
      screenName: 'GovTech',
      token: 'legacy-token',
    })
    expect($.auth.set).toHaveBeenNthCalledWith(2, {
      screenName: 'Ada Lovelace @ GovTech',
    })
  })

  it('falls back to username when real_name is missing', async () => {
    mocks.httpPost.mockResolvedValue({
      data: {
        ok: true,
        bot_user_id: 'B123',
        authed_user: { id: 'U123', access_token: 'user-token' },
        access_token: 'bot-token',
        team: { name: 'GovTech' },
      },
    })
    mocks.httpGet.mockResolvedValue({
      data: {
        ok: true,
        user: { id: 'U123', name: 'ada' },
      },
    })

    await verifyCredentials($)

    expect($.auth.set).toHaveBeenLastCalledWith({
      screenName: 'ada @ GovTech',
    })
  })

  it('throws when Slack omits the user access token', async () => {
    mocks.httpPost.mockResolvedValue({
      data: {
        ok: true,
        bot_user_id: 'B123',
        authed_user: { id: 'U123' },
        access_token: 'bot-token',
        team: { name: 'GovTech' },
      },
    })

    await expect(verifyCredentials($)).rejects.toThrow(
      'Slack did not return a user access token',
    )
    expect(mocks.httpGet).not.toHaveBeenCalled()
  })

  it('throws Slack users.info errors instead of crashing on real_name', async () => {
    mocks.httpPost.mockResolvedValue({
      data: {
        ok: true,
        bot_user_id: 'B123',
        authed_user: { id: 'U123', access_token: 'user-token' },
        access_token: 'bot-token',
        team: { name: 'GovTech' },
      },
    })
    mocks.httpGet.mockResolvedValue({
      data: {
        ok: false,
        error: 'missing_scope',
      },
    })

    await expect(verifyCredentials($)).rejects.toThrow('missing_scope')
  })
})
