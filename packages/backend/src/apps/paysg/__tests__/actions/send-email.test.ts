import type { IGlobalVariable } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import app from '../..'
import sendEmailAction from '../../actions/send-email'

const mocks = vi.hoisted(() => ({
  httpPost: vi.fn(() => ({})),
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
        position: 2,
        parameters: {
          // Pre-fill some required fields
          paymentId: 'sample-payment-id',
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
})
