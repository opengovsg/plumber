import type { IGlobalVariable } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import app from '../..'
import createPaymentAction from '../../actions/create-payment'
import { getApiBaseUrl } from '../../common/api'

const mocks = vi.hoisted(() => ({
  httpPost: vi.fn(() => ({
    data: {},
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
          payerIdentifier: 'test-identifier',
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

    mocks.httpPost.mockResolvedValue({
      data: {
        id: 'payment-id',
        payment_url: 'https://test2.local',
        stripe_payment_intent_id: 'stripe-payment',
        payment_qr_code_url: 'https://test3.local',
      },
    })
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
        payer_identifier: 'test-identifier',
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
})
