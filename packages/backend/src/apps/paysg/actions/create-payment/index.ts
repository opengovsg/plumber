import type { IRawAction } from '@plumber/types'
import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import StepError, { GenericSolution } from '@/errors/step'

import { requestSchema, responseSchema } from './schema'

const action: IRawAction = {
  name: 'Create payment',
  key: 'createPayment',
  description: 'Create a new PaySG payment',
  arguments: [
    {
      label: 'Reference ID',
      placeholder: 'INV-2026-001',
      key: 'referenceId',
      type: 'string' as const,
      required: true,
      variables: true,
    },
    {
      label: 'Payer Name',
      placeholder: 'Tan Wei Ming',
      key: 'payerName',
      type: 'string' as const,
      required: true,
      variables: true,
    },
    {
      label: 'Payer Address',
      placeholder: '1 Example Street, Singapore 123456',
      key: 'payerAddress',
      type: 'string' as const,
      required: false,
      variables: true,
    },
    {
      label: 'Payer Identifier',
      placeholder: 'Type the payer ID, max 20 characters',
      description: 'Max 20 characters. e.g. NRIC',
      key: 'payerIdentifier',
      type: 'string' as const,
      required: false,
      variables: true,
    },
    {
      label: 'Payer Email',
      placeholder: 'name@example.com',
      key: 'payerEmail',
      type: 'string' as const,
      required: false,
      variables: true,
    },
    {
      label: 'Description',
      placeholder: 'Course fee for May',
      key: 'description',
      type: 'string' as const,
      required: true,
      variables: true,
    },
    {
      label: 'Payment amount (in cents)',
      placeholder: '5000 (for $50.00)',
      key: 'paymentAmountCents',
      type: 'string' as const,
      required: true,
      variables: true,
    },
    {
      label: 'Due Date',
      placeholder: '02 Nov 2026',
      description:
        'Must be formatted in "2-digit-day month 4-digit-year" format (e.g. 02 Nov 2023)',
      key: 'dueDate',
      type: 'string' as const,
      required: false,
      variables: true,
    },
    {
      label: 'Return URL',
      placeholder: 'https://example.gov.sg/thank-you',
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

    try {
      const payload = requestSchema.parse($.step.parameters)

      const rawResponse = await $.http.post(
        `/v1/payment-services/:paymentServiceId/payments`,
        payload,
        {
          urlPathParams: {
            paymentServiceId,
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
        )
      }

      throw error
    }
  },
}

export default action
