import type { IRawAction } from '@plumber/types'
import { fromZodError } from 'zod-validation-error'

import StepError, { GenericSolution } from '@/errors/step'

import {
  rethrowAsPaySgStepError,
  UNEXPECTED_RESPONSE_SOLUTION,
} from '../../common/paysg-http-error'
import { requestSchema, responseSchema } from './schema'

const action: IRawAction = {
  name: 'Get payment',
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

    const request = requestSchema.safeParse($.step.parameters)
    if (!request.success) {
      const firstError = fromZodError(request.error).details[0]
      throw new StepError({
        name: `${firstError.message} at "${firstError.path}"`,
        solution: GenericSolution.ReconfigureInvalidField,
        kind: 'config',
      })
    }

    const rawResponse = await $.http
      .get(`/v1/payment-services/:paymentServiceId/payments/:paymentId`, {
        urlPathParams: {
          paymentServiceId,
          paymentId: request.data.paymentId,
        },
      })
      .catch(rethrowAsPaySgStepError)

    const response = responseSchema.safeParse(rawResponse.data)
    if (!response.success) {
      const firstError = fromZodError(response.error).details[0]
      throw new StepError({
        name: `${firstError.message} at "${firstError.path}"`,
        solution: UNEXPECTED_RESPONSE_SOLUTION,
        kind: 'third-party',
      })
    }

    $.setActionItem({ raw: response.data })
  },
}

export default action
