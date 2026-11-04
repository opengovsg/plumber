import type { IGlobalVariable } from '@plumber/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import StepError from '@/errors/step'

import { makeHttpError } from '../../../../../test/utils/make-http-error'
import sendSmsAction from '../../actions/send-sms'

const mocks = vi.hoisted(() => ({
  httpPost: vi.fn(),
}))

function twilioErrorBody(code: number, message: string) {
  return {
    code,
    message,
    more_info: `https://www.twilio.com/docs/errors/${code}`,
    status: 400,
  }
}

describe('send sms', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    mocks.httpPost.mockResolvedValue({
      data: {
        from: '+6580000000',
        to: '+6581237123',
        body: 'hello',
        status: 'queued',
        sid: 'SM123',
      },
    })
    $ = {
      auth: {
        set: vi.fn(),
        data: { accountSid: 'AC123', authToken: 'token' },
      },
      step: {
        id: 'step-id',
        appKey: 'twilio',
        key: 'sendSms',
        position: 2,
        parameters: {
          fromNumber: ' +6580000000 ',
          toNumber: '+6581237123',
          message: 'hello',
        },
      },
      http: {
        post: mocks.httpPost,
      } as unknown as IGlobalVariable['http'],
      setActionItem: vi.fn(),
    } as unknown as IGlobalVariable
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('sends the SMS and sets the action item', async () => {
    await sendSmsAction.run($)

    expect(mocks.httpPost).toHaveBeenCalledWith(
      '/2010-04-01/Accounts/AC123/Messages.json',
      'Body=hello&From=%2B6580000000&To=%2B6581237123',
    )
    expect($.setActionItem).toHaveBeenCalledWith({
      raw: {
        from: '+6580000000',
        to: '+6581237123',
        body: 'hello',
        status: 'queued',
        sid: 'SM123',
        success: true,
      },
    })
  })

  it.each([
    21211, 21212, 21266, 21408, 21602, 21603, 21604, 21606, 21608, 21610, 21614,
    21617,
  ])('throws a config StepError for Twilio error code %i', async (code) => {
    const httpError = makeHttpError({
      status: 400,
      data: twilioErrorBody(code, 'Twilio says no'),
    })
    mocks.httpPost.mockRejectedValueOnce(httpError)

    await expect(sendSmsAction.run($)).rejects.toMatchObject({
      kind: 'config',
      cause: httpError,
      message: expect.stringContaining(
        '"name":"Twilio rejected this SMS: Twilio says no"',
      ),
    })
  })

  it.each([
    {
      label: 'an unlisted Twilio error code',
      data: twilioErrorBody(21612, 'x'),
    },
    { label: 'no Twilio error code', data: undefined },
  ])('throws an internal StepError for a 400 with $label', async ({ data }) => {
    const httpError = makeHttpError({ status: 400, data })
    mocks.httpPost.mockRejectedValueOnce(httpError)

    await expect(sendSmsAction.run($)).rejects.toMatchObject({
      kind: 'internal',
      cause: httpError,
    })
  })

  it.each([401, 403, 404])(
    'throws a config StepError for a %i response',
    async (status) => {
      const httpError = makeHttpError({ status })
      mocks.httpPost.mockRejectedValueOnce(httpError)

      await expect(sendSmsAction.run($)).rejects.toMatchObject({
        kind: 'config',
        cause: httpError,
      })
    },
  )

  it.each([
    { status: 429, kind: 'internal' },
    { status: 409, kind: 'internal' },
    { status: 500, kind: 'third-party' },
    { status: 503, kind: 'third-party' },
  ])(
    'throws a $kind StepError for a $status response',
    async ({ status, kind }) => {
      const httpError = makeHttpError({ status })
      mocks.httpPost.mockRejectedValueOnce(httpError)

      await expect(sendSmsAction.run($)).rejects.toMatchObject({
        kind,
        cause: httpError,
      })
    },
  )

  it('throws a third-party StepError for a network error', async () => {
    const httpError = makeHttpError({ code: 'ECONNRESET' })
    mocks.httpPost.mockRejectedValueOnce(httpError)

    await expect(sendSmsAction.run($)).rejects.toMatchObject({
      kind: 'third-party',
      cause: httpError,
    })
  })

  it('throws an internal StepError when the request was never sent', async () => {
    const httpError = makeHttpError()
    mocks.httpPost.mockRejectedValueOnce(httpError)

    await expect(sendSmsAction.run($)).rejects.toMatchObject({
      kind: 'internal',
      cause: httpError,
    })
  })

  it('rethrows a non-HttpError unchanged', async () => {
    const error = new Error('boom')
    mocks.httpPost.mockRejectedValueOnce(error)

    const thrown = await sendSmsAction.run($).catch((e: unknown) => e)

    expect(thrown).toBe(error)
    expect(thrown).not.toBeInstanceOf(StepError)
  })
})
