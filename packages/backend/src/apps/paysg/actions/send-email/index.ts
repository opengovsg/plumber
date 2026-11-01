import type { IRawAction } from '@plumber/types'
import { fromZodError } from 'zod-validation-error'

import StepError, { GenericSolution } from '@/errors/step'

import { rethrowAsPaySgStepError } from '../../common/paysg-http-error'
import { requestSchema } from './schema'

const action: IRawAction = {
  name: 'Send payment email',
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

    const request = requestSchema.safeParse($.step.parameters)
    if (!request.success) {
      const firstError = fromZodError(request.error).details[0]
      throw new StepError({
        name: `${firstError.message} at "${firstError.path}"`,
        solution: GenericSolution.ReconfigureInvalidField,
        kind: 'config',
      })
    }

    // Empty response body expected, so just set a placeholder.
    await $.http
      .post(
        `/v1/payment-services/:paymentServiceId/payments/:paymentId/send-email`,
        {}, // No need for request body.
        {
          urlPathParams: {
            paymentServiceId,
            paymentId: request.data.paymentId,
          },
        },
      )
      .catch(rethrowAsPaySgStepError)
    $.setActionItem({ raw: { success: true } })
  },
}

export default action
