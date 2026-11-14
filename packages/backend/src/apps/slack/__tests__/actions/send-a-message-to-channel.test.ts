import { IGlobalVariable } from '@plumber/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import StepError from '@/errors/step'

import sendMessageToChannelAction from '../../actions/send-a-message-to-channel'

const mocks = vi.hoisted(() => ({
  httpPost: vi.fn(),
  setActionItem: vi.fn(),
}))

describe('send a message to channel', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      step: {
        id: '123',
        appKey: 'slack',
        position: 2,
        parameters: {
          channel: 'C123',
          message: 'hello',
          sendAsBot: false,
        },
      },
      http: {
        post: mocks.httpPost,
      } as unknown as IGlobalVariable['http'],
      setActionItem: mocks.setActionItem,
    } as unknown as IGlobalVariable
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('sets the response as the action item when Slack returns ok', async () => {
    const data = { ok: true, ts: '1.0' }
    mocks.httpPost.mockResolvedValueOnce({ data })

    await sendMessageToChannelAction.run($)

    expect(mocks.setActionItem).toHaveBeenCalledWith({ raw: data })
  })

  it.each([
    'account_inactive',
    'invalid_auth',
    'token_revoked',
    'token_expired',
    'team_access_not_granted',
    'channel_not_found',
    'not_in_channel',
    'is_archived',
    'restricted_action',
    'no_permission',
    'msg_too_long',
    'no_text',
  ])('throws a config StepError for %s', async (code) => {
    mocks.httpPost.mockResolvedValueOnce({ data: { ok: false, error: code } })

    const error = await sendMessageToChannelAction.run($).catch((e) => e)

    expect(error).toBeInstanceOf(StepError)
    expect(error).toMatchObject({ kind: 'config' })
    expect(error.message).toContain(code)
  })

  it('tells the user to connect an active account for account_inactive', async () => {
    mocks.httpPost.mockResolvedValueOnce({
      data: { ok: false, error: 'account_inactive' },
    })

    const error = await sendMessageToChannelAction.run($).catch((e) => e)

    expect(error).toMatchObject({ kind: 'config' })
    expect(error.message).toContain(
      '"name":"Slack connection is no longer valid (account_inactive)"',
    )
    expect(error.message).toContain(
      '"solution":"Your Slack account or workspace may be deactivated. Connect an active Slack account, then select it in this step."',
    )
  })

  it.each([
    'fatal_error',
    'internal_error',
    'service_unavailable',
    'request_timeout',
  ])('throws a third-party StepError for %s', async (code) => {
    mocks.httpPost.mockResolvedValueOnce({ data: { ok: false, error: code } })

    await expect(sendMessageToChannelAction.run($)).rejects.toMatchObject({
      kind: 'third-party',
    })
  })

  it.each([
    'not_authed',
    'ratelimited',
    'missing_scope',
    'invalid_arguments',
    'invalid_blocks',
    'some_new_code',
  ])('throws an internal StepError for %s', async (code) => {
    mocks.httpPost.mockResolvedValueOnce({ data: { ok: false, error: code } })

    const error = await sendMessageToChannelAction.run($).catch((e) => e)

    expect(error).toBeInstanceOf(StepError)
    expect(error).toMatchObject({ kind: 'internal' })
    expect(error.message).toContain(code)
  })

  it('throws an internal StepError when Slack omits the error code', async () => {
    mocks.httpPost.mockResolvedValueOnce({ data: { ok: false } })

    const error = await sendMessageToChannelAction.run($).catch((e) => e)

    expect(error).toBeInstanceOf(StepError)
    expect(error).toMatchObject({ kind: 'internal' })
    expect(error.message).toContain(
      '"solution":"Please contact [Plumber support](https://go.gov.sg/plumber-support) for assistance."',
    )
  })
})
