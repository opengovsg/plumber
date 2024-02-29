import type { IGlobalVariable } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import app from '../..'
import getPaymentAction from '../../actions/get-payment'
import { getApiBaseUrl } from '../../common/api'
import { MOCK_PAYMENT } from '../utils'

const mocks = vi.hoisted(() => ({
  httpGet: vi.fn(() => ({
    data: MOCK_PAYMENT,
  })),
}))

describe('get payment', () => {
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
        position: 2,
        parameters: {
          // Pre-fill some required fields
          paymentId: 'sample-payment-id',
        },
      },
      http: {
        get: mocks.httpGet,
      } as unknown as IGlobalVariable['http'],
      setActionItem: vi.fn(),
      app,
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each(['paysg_stag_abcd, paysg_live_abcd'])(
    'invokes the correct URL based on the API key and payment ID',
    async (apiKey) => {
      $.auth.data.apiKey = apiKey
      const expectedBaseUrl = getApiBaseUrl($.auth.data.apiKey)

      await getPaymentAction.run($)

      expect(mocks.httpGet).toHaveBeenCalledWith(
        '/v1/payment-services/sample-payment-service-id/payments/sample-payment-id',
        expect.objectContaining({
          baseURL: expectedBaseUrl,
          headers: {
            'x-api-key': $.auth.data.apiKey,
          },
        }),
      )
    },
  )

  it('parses the response correctly', async () => {
    await getPaymentAction.run($)
    expect($.setActionItem).toBeCalledWith({
      raw: {
        id: MOCK_PAYMENT.id,
        paymentUrl: MOCK_PAYMENT.payment_url,
        stripePaymentIntentId: MOCK_PAYMENT.stripe_payment_intent_id,
        paymentQrCodeUrl: MOCK_PAYMENT.payment_qr_code_url,
        amountInDollars: '11.30',
        amountInCents: 1130,
        paymentStatus: 'unpaid',
      },
    })
  })
})
