import type { IRawAction } from '@plumber/types'

import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import StepError, { GenericSolution } from '@/errors/step'

import { requestSchema } from './schema'

const action: IRawAction = {
  name: 'Send Payment Email',
  key: 'sendEmail',
  description:
    'Send email to payee for a payment that has previously been created',
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

      // Empty response body expected, so just set a placeholder.
      await $.http.post(
        `/v1/payment-services/:paymentServiceId/payments/:paymentId/send-email`,
        {}, // No need for request body.
        {
          urlPathParams: {
            paymentServiceId,
            paymentId,
          },
        },
      )
      $.setActionItem({ raw: { success: true } })
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
