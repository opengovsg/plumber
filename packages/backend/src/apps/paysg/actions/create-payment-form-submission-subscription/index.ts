import type { IRawAction } from '@plumber/types'
import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import StepError, { GenericSolution } from '@/errors/step'

import { requestSchema } from './schema'

const action: IRawAction = {
  name: 'Create payment form submission for subscription',
  key: 'createPaymentFormSubmissionSubscription',
  description:
    'Create a new submission for a payment form, and initiate a subscription',
  arguments: [
    {
      label: 'Payment Form Link',
      description: 'This can be found on your PaySG payment services dashboard',
      key: 'formId',
      type: 'string' as const,
      required: true,
      placeholder: 'https://pay.gov.sg/forms/aBC123Def456HijK789LMn',
    },
    {
      label: 'FormSG Form ID',
      placeholder: 'Pick the form ID from an earlier step',
      description: 'Input the variable corresponding to form ID here',
      key: 'formsg_form_id',
      type: 'string' as const,
      required: true,
      variables: true,
    },
    {
      label: 'FormSG Submission ID',
      placeholder: 'Pick the submission ID from an earlier step',
      key: 'formsg_submission_id',
      type: 'string' as const,
      required: true,
      variables: true,
    },
    {
      label: 'FormSG Reference Field Answer',
      placeholder: 'Pick the reference answer from your form',
      key: 'nonce',
      type: 'string' as const,
      required: true,
      variables: true,
    },
    {
      label: 'Payer Name',
      placeholder: 'Tan Wei Ming',
      key: 'payer_name',
      type: 'string' as const,
      required: true,
      variables: true,
    },
    {
      label: 'Payer Email',
      placeholder: 'name@example.com',
      key: 'payer_email',
      type: 'string' as const,
      required: true,
      variables: true,
    },
    {
      label: 'Payer Address',
      placeholder: '1 Example Street, Singapore 123456',
      key: 'payer_address',
      type: 'string' as const,
      required: false,
      variables: true,
    },
    {
      label: 'Payer Identifier',
      placeholder: 'Type the payer ID, max 20 characters',
      key: 'payer_identifier',
      type: 'string' as const,
      required: false,
      variables: true,
    },
    {
      label: 'Amount (in cents)',
      placeholder: '5000 (for $50.00)',
      key: 'amount_in_cents',
      type: 'string' as const,
      required: true,
      variables: true,
    },
    {
      label: 'Frequency',
      key: 'frequency',
      type: 'dropdown',
      options: [
        {
          label: 'Monthly',
          value: 'monthly',
        },
      ],
      showOptionValue: false,
      value: 'monthly',
      required: true,
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
      label: 'Additional responses',
      description: 'These will be included in reports exported from PaySG',
      key: 'responses',
      type: 'multirow-multicol' as const,
      required: false,
      subFields: [
        {
          placeholder: 'Question',
          key: 'question',
          type: 'string' as const,
          required: true,
          variables: true,
          customStyle: { flex: 1, minWidth: 0, maxWidth: '50%' },
        },
        {
          placeholder: 'Answer',
          key: 'answer',
          type: 'string' as const,
          required: true,
          variables: true,
          customStyle: { flex: 1, minWidth: 0, maxWidth: '50%' },
        },
      ],
    },
  ],

  async run($) {
    const paymentServiceId = $.auth.data.paymentServiceId as string

    try {
      const { formId, ...body } = requestSchema.parse($.step.parameters)

      await $.http.post(
        `/v1/payment-services/:paymentServiceId/forms/:formId/subscription-submissions`,
        body,
        {
          urlPathParams: {
            paymentServiceId,
            formId,
          },
        },
      )
      $.setActionItem({ raw: { success: true } })
    } catch (error) {
      if (error instanceof ZodError) {
        const firstError = fromZodError(error).details[0]

        throw new StepError(
          `${firstError.message} under set up step`,
          GenericSolution.ReconfigureInvalidField,
        )
      }

      throw error
    }
  },
}

export default action
