import type { IGlobalVariable } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import app from '../..'
import createPaymentAction from '../../actions/create-payment'
import getApiBaseUrl from '../../common/get-api-base-url'

const mocks = vi.hoisted(() => ({
  httpPost: vi.fn(() => ({
    data: {},
  })),
}))

describe('Create payment action', () => {
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
        parameters: {},
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

  it('invokes the correct URL based on the API key', async () => {
    $.auth.data.apiKey = 'paysg_stag_abcd'
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
  })

  it('builds the payload correctly', async () => {
    $.step.parameters.referenceId = 'test-reference-id'
    $.step.parameters.payerName = 'test-name'
    $.step.parameters.payerAddress = 'test-address'
    $.step.parameters.payerIdentifier = 'test-identifier'
    $.step.parameters.payerEmail = 'test@email.local'
    $.step.parameters.description = 'test-description'
    $.step.parameters.paymentAmountCents = '12345'
    $.step.parameters.dueDate = '12-12-2023'
    $.step.parameters.returnUrl = 'test.local'
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
        due_date: '12-12-2023',
        return_url: 'test.local',
        metadata: {
          'test-key-1': 'test-value-1',
          'test-key-2': 'test-value-2',
        },
      },
      expect.anything(),
    )
  })
})
