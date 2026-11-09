import { IGlobalVariable } from '@plumber/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import StepError from '@/errors/step'

import findMessageAction from '../../actions/find-message'

const mocks = vi.hoisted(() => ({
  httpGet: vi.fn(),
  setActionItem: vi.fn(),
}))

describe('find message', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      step: {
        id: '123',
        appKey: 'slack',
        position: 2,
        parameters: {
          query: 'hello',
          sortBy: 'score',
          sortDirection: 'desc',
        },
      },
      http: {
        get: mocks.httpGet,
      } as unknown as IGlobalVariable['http'],
      setActionItem: mocks.setActionItem,
    } as unknown as IGlobalVariable
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('sets the first match as the action item when Slack returns ok', async () => {
    const match = { text: 'hello' }
    mocks.httpGet.mockResolvedValueOnce({
      data: { ok: true, messages: { matches: [match] } },
    })

    await findMessageAction.run($)

    expect(mocks.setActionItem).toHaveBeenCalledWith({ raw: match })
  })

  it.each(['account_inactive', 'invalid_auth'])(
    'throws a config StepError for %s',
    async (code) => {
      mocks.httpGet.mockResolvedValueOnce({ data: { ok: false, error: code } })

      const error = await findMessageAction.run($).catch((e) => e)

      expect(error).toBeInstanceOf(StepError)
      expect(error).toMatchObject({ kind: 'config' })
      expect(error.message).toContain(code)
    },
  )

  it('throws a third-party StepError for internal_error', async () => {
    mocks.httpGet.mockResolvedValueOnce({
      data: { ok: false, error: 'internal_error' },
    })

    await expect(findMessageAction.run($)).rejects.toMatchObject({
      kind: 'third-party',
    })
  })

  it('throws a config StepError when the connection lacks search:read', async () => {
    mocks.httpGet.mockResolvedValueOnce({
      data: {
        ok: false,
        error: 'missing_scope',
        needed: 'search:read',
        provided: 'channels:read,chat:write,users:read',
      },
    })

    const error = await findMessageAction.run($).catch((e) => e)

    expect(error).toBeInstanceOf(StepError)
    expect(error).toMatchObject({ kind: 'config' })
    expect(error.message).toContain(
      '"name":"Slack connection cannot search messages"',
    )
  })

  it.each([
    { error: 'missing_scope' },
    { error: 'missing_scope', needed: 'channels:read' },
    { error: 'some_new_code' },
  ])('throws an internal StepError for %o', async (data) => {
    mocks.httpGet.mockResolvedValueOnce({ data: { ok: false, ...data } })

    await expect(findMessageAction.run($)).rejects.toMatchObject({
      kind: 'internal',
    })
  })
})
