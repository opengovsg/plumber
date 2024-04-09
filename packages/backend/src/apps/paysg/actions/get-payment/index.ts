import type { IRawAction } from '@plumber/types'

import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import StepError, { GenericSolution } from '@/errors/step'

import { requestSchema, responseSchema } from './schema'

const action: IRawAction = {
  name: 'Get Payment',
  key: 'getPayment',
  description: 'Get details of a payment that has previously been created',
  arguments: [
    {
      label: 'Payment ID',
      key: 'paymentId',
      type: 'string' as const,
      required: true,
      variables: true,
    },
  ],

  async run($) {
    const paymentServiceId = $.auth.data.paymentServiceId as string

    try {
      const { paymentId } = requestSchema.parse($.step.parameters)

      const rawResponse = await $.http.get(
        `/v1/payment-services/:paymentServiceId/payments/:paymentId`,
        {
          urlPathParams: {
            paymentServiceId,
            paymentId,
          },
        },
      )
      const response = responseSchema.parse(rawResponse.data)

      $.setActionItem({ raw: response })
    } catch (error) {
      if (error instanceof ZodError) {
        const firstError = fromZodError(error).details[0]

        throw new StepError(
          `${firstError.message} at "${firstError.path}"`,
          GenericSolution.ReconfigureInvalidField,
          $.step.position,
          $.app.name,
        )
      }

      throw error
    }
  },
}

export default action
