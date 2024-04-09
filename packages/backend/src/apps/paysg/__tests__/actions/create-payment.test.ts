import type { IGlobalVariable } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import app from '../..'
import createPaymentAction from '../../actions/create-payment'
import { MOCK_PAYMENT } from '../utils'

const mocks = vi.hoisted(() => ({
  httpPost: vi.fn(() => ({
    data: MOCK_PAYMENT,
  })),
}))

describe('create payment', () => {
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

  it.each(['paysg_stag_abcd, paysg_live_abcd'])(
    'invokes the correct url with urlPathParams',
    async (apiKey) => {
      $.auth.data.apiKey = apiKey

      await createPaymentAction.run($)

      expect(mocks.httpPost).toHaveBeenCalledWith(
        '/v1/payment-services/:paymentServiceId/payments',
        expect.anything(),
        {
          urlPathParams: {
            paymentServiceId: 'sample-payment-service-id',
          },
        },
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

    await createPaymentAction.run($)

    expect(mocks.httpPost).toHaveBeenCalledWith(
      '/v1/payment-services/:paymentServiceId/payments',
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
      {
        urlPathParams: {
          paymentServiceId: 'sample-payment-service-id',
        },
      },
    )
  })

  it('parses the response correctly', async () => {
    $.step.parameters.dueDate = '02 Jan 2023'
    $.step.parameters.returnUrl = 'https://test.local'
    $.step.parameters.metadata = [
      { key: 'test-key-1', value: 'test-value-1' },
      { key: 'test-key-2', value: 'test-value-2' },
    ]

    await createPaymentAction.run($)
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

  it('parses the response amount in dollars correctly', async () => {
    $.step.parameters.dueDate = '02 Jan 2023'
    $.step.parameters.returnUrl = 'https://test.local'
    $.step.parameters.metadata = [
      { key: 'test-key-1', value: 'test-value-1' },
      { key: 'test-key-2', value: 'test-value-2' },
    ]

    mocks.httpPost.mockReturnValueOnce({
      data: {
        ...MOCK_PAYMENT,
        amount_in_cents: 31,
      },
    })

    await createPaymentAction.run($)
    expect($.setActionItem).toBeCalledWith({
      raw: {
        id: MOCK_PAYMENT.id,
        paymentUrl: MOCK_PAYMENT.payment_url,
        stripePaymentIntentId: MOCK_PAYMENT.stripe_payment_intent_id,
        paymentQrCodeUrl: MOCK_PAYMENT.payment_qr_code_url,
        amountInDollars: '0.31',
        amountInCents: 31,
        paymentStatus: 'unpaid',
      },
    })
  })

  it.each([
    {
      payerName: 'a\u2010b\u2011c\u2012d\u2014e\u2015f',
      payerAddress: '\u2018topkek\u2019',
      expectedPayerName: 'a-b-c-d-e-f',
      expectedPayerAddress: `'topkek'`,
    },
    // Check that it replaces _all_ occurances.
    {
      payerName: 'a\u2010\u2010b\u2010c\u2012d\u2012\u2012e',
      payerAddress:
        '\u2018\u2018top\u2019\u2019 \u2012 \u2019\u2018kek\u2018\u2019',
      expectedPayerName: 'a--b-c-d--e',
      expectedPayerAddress: `''top'' - ''kek''`,
    },
    // Check that it handles halfwidth and fullwidth conversion
    {
      payerName: '\uff21\uff22\uff23\uff44\uff45\uff46',
      payerAddress: '#\uff10\uff12\uff0d\uff18\uff15',
      expectedPayerName: 'ABCdef',
      expectedPayerAddress: `#02-85`,
    },
    // Check that latin characters are not impacted
    {
      payerName: 'a--b\u2010c-d--e',
      payerAddress: `\u2018top' \u2012 'kek\u2019`,
      expectedPayerName: 'a--b-c-d--e',
      expectedPayerAddress: `'top' - 'kek'`,
    },
  ])(
    'normalizes special characters',
    async ({
      payerName,
      payerAddress,
      expectedPayerName,
      expectedPayerAddress,
    }) => {
      $.step.parameters.payerName = payerName
      $.step.parameters.payerAddress = payerAddress
      await createPaymentAction.run($)

      expect(mocks.httpPost).toBeCalledWith(
        '/v1/payment-services/:paymentServiceId/payments',
        expect.objectContaining({
          payer_name: expectedPayerName,
          payer_address: expectedPayerAddress,
        }),
        {
          urlPathParams: {
            paymentServiceId: 'sample-payment-service-id',
          },
        },
      )
    },
  )
})
