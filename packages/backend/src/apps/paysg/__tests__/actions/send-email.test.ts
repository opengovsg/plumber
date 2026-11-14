import type { IGlobalVariable } from '@plumber/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import app from '../..'
import { makeHttpError } from '../../../../../test/utils/make-http-error'
import sendEmailAction from '../../actions/send-email'

const mocks = vi.hoisted(() => ({
  httpPost: vi.fn(async () => ({})),
}))

describe('send payment email', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      auth: {
        set: vi.fn(),
        data: {
          apiKey: 'paysg_stag_abcd',
          paymentServiceId: 'sample-payment-service-id',
        },
      },
      step: {
        id: 'herp-derp',
        appKey: 'paysg',
        key: 'sendEmail',
        position: 2,
        parameters: {
          // Pre-fill some required fields
          paymentId: 'sample-payment-id',
        },
        version: 1,
      },
      http: {
        post: mocks.httpPost,
      } as unknown as IGlobalVariable['http'],
      setActionItem: vi.fn(),
      app,
    } as unknown as IGlobalVariable
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it.each(['paysg_stag_abcd, paysg_live_abcd'])(
    'invokes the correct URL with urlPathParams',
    async (apiKey) => {
      $.auth.data.apiKey = apiKey

      await sendEmailAction.run($)

      expect(mocks.httpPost).toHaveBeenCalledWith(
        '/v1/payment-services/:paymentServiceId/payments/:paymentId/send-email',
        {},
        {
          urlPathParams: {
            paymentServiceId: 'sample-payment-service-id',
            paymentId: 'sample-payment-id',
          },
        },
      )
    },
  )

  it('throws a config StepError when a field is invalid', async () => {
    $.step.parameters.paymentId = ' '

    await expect(sendEmailAction.run($)).rejects.toMatchObject({
      kind: 'config',
    })
    expect(mocks.httpPost).not.toHaveBeenCalled()
  })

  it.each([
    { status: 404, kind: 'config' },
    { status: 500, kind: 'third-party' },
    { status: 429, kind: 'internal' },
  ])(
    'throws a $kind StepError with the HttpError as cause on a $status response',
    async ({ status, kind }) => {
      const httpError = makeHttpError({ status })
      mocks.httpPost.mockRejectedValueOnce(httpError as never)

      await expect(sendEmailAction.run($)).rejects.toMatchObject({
        kind,
        cause: httpError,
      })
    },
  )
})
