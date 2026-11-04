import type { IGlobalVariable } from '@plumber/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import app from '../..'
import { makeHttpError } from '../../../../../test/utils/make-http-error'
import action from '../../actions/create-payment-form-submission-subscription'

const mocks = vi.hoisted(() => ({
  httpPost: vi.fn(async () => ({})),
}))

describe('create payment form submission subscription', () => {
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
        key: 'createPaymentFormSubmissionSubscription',
        position: 2,
        parameters: {
          formId: 'https://pay.gov.sg/forms/sample-form-id',
          formsg_form_id: '0123456789abcdef01234567',
          formsg_submission_id: 'sample-submission-id',
          nonce: 'sample-nonce',
          payer_name: 'test-name',
          payer_email: 'test@email.local',
          amount_in_cents: '12345',
          description: 'test-description',
          frequency: 'monthly',
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

  it('posts to the form submission URL', async () => {
    await action.run($)

    expect(mocks.httpPost).toHaveBeenCalledWith(
      '/v1/payment-services/:paymentServiceId/forms/:formId/subscription-submissions',
      expect.objectContaining({ payer_name: 'test-name' }),
      {
        urlPathParams: {
          paymentServiceId: 'sample-payment-service-id',
          formId: 'sample-form-id',
        },
      },
    )
    expect($.setActionItem).toHaveBeenCalledWith({ raw: { success: true } })
  })

  it('throws a config StepError when a field is invalid', async () => {
    $.step.parameters.formId = 'https://example.com/forms/sample-form-id'

    await expect(action.run($)).rejects.toMatchObject({
      kind: 'config',
      message: expect.stringContaining(
        '"name":"Invalid payment form link under set up step"',
      ),
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

      await expect(action.run($)).rejects.toMatchObject({
        kind,
        cause: httpError,
      })
    },
  )
})
