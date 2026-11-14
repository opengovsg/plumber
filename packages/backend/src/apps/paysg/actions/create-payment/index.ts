import type { IRawAction } from '@plumber/types'
import { fromZodError } from 'zod-validation-error'

import StepError, { GenericSolution } from '@/errors/step'

import { rethrowAsPaySgStepError } from '../../common/paysg-http-error'
import { requestSchema, responseSchema } from './schema'

const action: IRawAction = {
  name: 'Create payment',
  key: 'createPayment',
  description: 'Create a new PaySG payment',
  arguments: [
    {
      label: 'Reference ID',
      key: 'referenceId',
      type: 'string' as const,
      required: true,
      variables: true,
    },
    {
      label: 'Payer Name',
      key: 'payerName',
      type: 'string' as const,
      required: true,
      variables: true,
    },
    {
      label: 'Payer Address',
      key: 'payerAddress',
      type: 'string' as const,
      required: false,
      variables: true,
    },
    {
      label: 'Payer Identifier',
      description: 'Max 20 characters. e.g. NRIC',
      key: 'payerIdentifier',
      type: 'string' as const,
      required: false,
      variables: true,
    },
    {
      label: 'Payer Email',
      key: 'payerEmail',
      type: 'string' as const,
      required: false,
      variables: true,
    },
    {
      label: 'Description',
      key: 'description',
      type: 'string' as const,
      required: true,
      variables: true,
    },
    {
      label: 'Payment amount (in cents)',
      key: 'paymentAmountCents',
      type: 'string' as const,
      required: true,
      variables: true,
    },
    {
      label: 'Due Date',
      description:
        'Must be formatted in "2-digit-day month 4-digit-year" format (e.g. 02 Nov 2023)',
      key: 'dueDate',
      type: 'string' as const,
      required: false,
      variables: true,
    },
    {
      label: 'Return URL',
      key: 'returnUrl',
      type: 'string' as const,
      required: false,
      variables: true,
    },
    {
      label: 'Metadata',
      key: 'metadata',
      type: 'multirow-multicol' as const,
      required: false,
      subFields: [
        {
          placeholder: 'Key',
          key: 'key',
          type: 'string' as const,
          required: true,
          variables: true,
          customStyle: { flex: 2, minWidth: 0, maxWidth: '40%' },
        },
        {
          placeholder: 'Value',
          key: 'value',
          type: 'string' as const,
          required: true,
          variables: true,
          customStyle: { flex: 3, minWidth: 0, maxWidth: '60%' },
        },
      ],
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
      .post(`/v1/payment-services/:paymentServiceId/payments`, request.data, {
        urlPathParams: {
          paymentServiceId,
        },
      })
      .catch(rethrowAsPaySgStepError)

    const response = responseSchema.safeParse(rawResponse.data)
    if (!response.success) {
      const firstError = fromZodError(response.error).details[0]
      throw new StepError({
        name: `${firstError.message} at "${firstError.path}"`,
        solution:
          'PaySG returned an unexpected response. Please contact support@plumber.gov.sg for assistance.',
        kind: 'internal',
      })
    }

    $.setActionItem({ raw: response.data })
  },
}

export default action
