import type { IGlobalVariable } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import app from '../..'
import createPaymentAction from '../../actions/create-payment'
import { getApiBaseUrl } from '../../common/api'

const MOCK_RESPONSE = {
  id: 'ZbzTvadjmP0wd7RRxhWtj',
  due_date: null as null,
  metadata: {
    'product code': '123',
  },
  payout_id: null as null,
  created_at: '2023-08-03T17:36:52.634+08:00',
  creator_id: 'user_xxx',
  payer_name: 'Andy Lau',
  updated_at: '2023-08-03T17:36:52.634+08:00',
  description: 'Payment for XXX',
  payer_email: 'abc@gmail.com',
  payment_url: 'http://pay.gov.sg/payments/ZbzTvadjmP0wd7RRxhWtj',
  return_url: 'https://open.gov.sg',
  reference_id: 'PAYMENT_001',
  latest_status: 'unpaid',
  payer_address: 'Blk 123, Yishun Avenue 2, #08-88, Singapore 123456',
  refund_status: 'not_refunded',
  payment_status: 'unpaid',
  amount_in_cents: 1130,
  payer_identifier: 'S1234567A',
  paid_out_timestamp: null as null,
  payment_service_id: 'payment_service_xxx',
  email_delivery_status: 'unsent',
  payment_sent_timestamp: null as null,
  stripe_payment_intent_id: 'pi_xxx',
  payment_cancelled_timestamp: null as null,
  payment_succeeded_timestamp: null as null,
  payment_fully_refunded_timestamp: null as null,
  // this is not documented
  payment_qr_code_url: 'https://test3.local',
}

const mocks = vi.hoisted(() => ({
  httpPost: vi.fn(() => ({
    // Mock data retrieved from PaySG Guide: https://guide.pay.gov.sg/api-resources/payments/create-a-payment
    data: MOCK_RESPONSE,
  })),
}))

describe('create payment', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      auth: {
        set: vi.fn(),
        data: {
          apiKey: 'sample-api-key',
          paymentServiceId: 'sample-payment-service-id',
        },
      },
      step: {
        id: 'herp-derp',
        appKey: 'paysg',
        position: 2,
        parameters: {
          // Pre-fill some required fields
          referenceId: 'test-reference-id',
          payerName: 'test-name',
          payerAddress: 'test-address',
          payerIdentifier: 'test-id',
          payerEmail: 'test@email.local',
          description: 'test-description',
          paymentAmountCents: '12345',
        },
      },
      http: {
        post: mocks.httpPost,
      } as unknown as IGlobalVariable['http'],
      setActionItem: vi.fn(),
      app,
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each(['paysg_stag_abcd'])(
    'invokes the correct URL based on the API key',
    async (apiKey) => {
      $.auth.data.apiKey = apiKey
      const expectedBaseUrl = getApiBaseUrl($.auth.data.apiKey)

      await createPaymentAction.run($)

      expect(mocks.httpPost).toHaveBeenCalledWith(
        '/v1/payment-services/sample-payment-service-id/payments',
        expect.anything(),
        expect.objectContaining({
          baseURL: expectedBaseUrl,
          headers: {
            'x-api-key': $.auth.data.apiKey,
          },
        }),
      )
    },
  )

  it('builds the payload correctly', async () => {
    $.step.parameters.dueDate = '02 Jan 2023'
    $.step.parameters.returnUrl = 'https://test.local'
    $.step.parameters.metadata = [
      { key: 'test-key-1', value: 'test-value-1' },
      { key: 'test-key-2', value: 'test-value-2' },
    ]

    $.auth.data.apiKey = 'paysg_stag_abcd'
    await createPaymentAction.run($)

    expect(mocks.httpPost).toHaveBeenCalledWith(
      '/v1/payment-services/sample-payment-service-id/payments',
      {
        reference_id: 'test-reference-id',
        payer_name: 'test-name',
        payer_address: 'test-address',
        payer_identifier: 'test-id',
        payer_email: 'test@email.local',
        description: 'test-description',
        amount_in_cents: 12345, // Converted to number
        due_date: '02-JAN-2023',
        return_url: 'https://test.local',
        metadata: {
          'test-key-1': 'test-value-1',
          'test-key-2': 'test-value-2',
        },
      },
      expect.anything(),
    )
  })

  it('parses the response correctly', async () => {
    $.step.parameters.dueDate = '02 Jan 2023'
    $.step.parameters.returnUrl = 'https://test.local'
    $.step.parameters.metadata = [
      { key: 'test-key-1', value: 'test-value-1' },
      { key: 'test-key-2', value: 'test-value-2' },
    ]

    $.auth.data.apiKey = 'paysg_stag_abcd'
    await createPaymentAction.run($)
    expect($.setActionItem).toBeCalledWith({
      raw: {
        id: MOCK_RESPONSE.id,
        paymentUrl: MOCK_RESPONSE.payment_url,
        stripePaymentIntentId: MOCK_RESPONSE.stripe_payment_intent_id,
        paymentQrCodeUrl: MOCK_RESPONSE.payment_qr_code_url,
        amountInDollars: '11.30',
        amountInCents: 1130,
      },
    })
  })

  it('parses the response amount in dollars correctly', async () => {
    $.step.parameters.dueDate = '02 Jan 2023'
    $.step.parameters.returnUrl = 'https://test.local'
    $.step.parameters.metadata = [
      { key: 'test-key-1', value: 'test-value-1' },
      { key: 'test-key-2', value: 'test-value-2' },
    ]

    $.auth.data.apiKey = 'paysg_stag_abcd'

    mocks.httpPost.mockReturnValueOnce({
      data: {
        ...MOCK_RESPONSE,
        amount_in_cents: 31,
      },
    })

    await createPaymentAction.run($)
    expect($.setActionItem).toBeCalledWith({
      raw: {
        id: MOCK_RESPONSE.id,
        paymentUrl: MOCK_RESPONSE.payment_url,
        stripePaymentIntentId: MOCK_RESPONSE.stripe_payment_intent_id,
        paymentQrCodeUrl: MOCK_RESPONSE.payment_qr_code_url,
        amountInDollars: '0.31',
        amountInCents: 31,
      },
    })
  })
})
