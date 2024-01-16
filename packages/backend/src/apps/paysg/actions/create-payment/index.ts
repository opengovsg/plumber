import type { IRawAction } from '@plumber/types'

import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import { VALIDATION_ERROR_SOLUTION } from '@/apps/postman/common/constants'
import StepError from '@/errors/step'

import { getApiBaseUrl } from '../../common/api'

import { requestSchema, responseSchema } from './schema'

const action: IRawAction = {
  name: 'Create Payment',
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
      required: true,
      variables: true,
    },
    {
      label: 'Payer Identifier',
      description: 'e.g. NRIC',
      key: 'payerIdentifier',
      type: 'string' as const,
      required: true,
      variables: true,
    },
    {
      label: 'Payer Email',
      key: 'payerEmail',
      type: 'string' as const,
      required: true,
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
      type: 'multirow' as const,
      required: false,
      subFields: [
        {
          placeholder: 'Key',
          key: 'key',
          type: 'string' as const,
          required: true,
          variables: true,
        },
        {
          placeholder: 'Value',
          key: 'value',
          type: 'string' as const,
          required: true,
          variables: true,
        },
      ],
    },
  ],

  async run($) {
    const apiKey = $.auth.data.apiKey as string
    const baseUrl = getApiBaseUrl(apiKey)
    const paymentServiceId = $.auth.data.paymentServiceId as string

    try {
      const payload = requestSchema.parse($.step.parameters)

      const rawResponse = await $.http.post(
        `/v1/payment-services/${paymentServiceId}/payments`,
        payload,
        {
          baseURL: baseUrl,
          headers: {
            'x-api-key': apiKey,
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
          VALIDATION_ERROR_SOLUTION,
          $.step.position,
          $.app.name,
        )
      }

      throw error
    }
  },
}

export default action
