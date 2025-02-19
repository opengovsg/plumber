import type { IRawAction } from '@plumber/types'

import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import StepError from '@/errors/step'

import { requestSchema } from './schema'

const action: IRawAction = {
  name: 'Create payment form submission',
  key: 'createPaymentFormSubmission',
  description:
    'Create a new submission for a payment form, and initiate a payment request',
  arguments: [
    {
      label: 'Payment Form Link',
      description: 'This can be found on your PaySG payment services dashboard',
      key: 'formId',
      type: 'string' as const,
      required: true,
      placeholder: 'e.g. https://pay.gov.sg/forms/aBC123Def456HijK789LMn',
    },
    {
      label: 'FormSG Form ID',
      description: 'Input the variable corresponding to form ID here',
      key: 'formsg_form_id',
      type: 'string' as const,
      required: true,
      variables: true,
    },
    {
      label: 'FormSG Submission ID',
      key: 'formsg_submission_id',
      type: 'string' as const,
      required: true,
      variables: true,
    },
    {
      label: 'FormSG Reference Field Answer',
      key: 'nonce',
      type: 'string' as const,
      required: true,
      variables: true,
    },
    {
      label: 'Payer Name',
      key: 'payer_name',
      type: 'string' as const,
      required: true,
      variables: true,
    },
    {
      label: 'Payer Email',
      key: 'payer_email',
      type: 'string' as const,
      required: false,
      variables: true,
    },
    {
      label: 'Amount (in cents)',
      key: 'amount_in_cents',
      type: 'string' as const,
      required: true,
      variables: true,
    },
    {
      label: 'Description',
      key: 'description',
      type: 'string' as const,
      required: false,
      variables: true,
    },
    {
      label: 'Additional responses',
      description: 'These will be included in reports exported from PaySG',
      key: 'responses',
      type: 'multirow' as const,
      required: false,
      subFields: [
        {
          placeholder: 'Question',
          key: 'question',
          type: 'string' as const,
          required: true,
          variables: true,
        },
        {
          placeholder: 'Answer',
          key: 'answer',
          type: 'string' as const,
          required: true,
          variables: true,
        },
      ],
    },
  ],

  async run($) {
    const paymentServiceId = $.auth.data.paymentServiceId as string

    try {
      const { formId, ...body } = requestSchema.parse($.step.parameters)

      await $.http.post(
        `/v1/payment-services/:paymentServiceId/forms/:formId/submissions`,
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
          `${firstError.message} at "${firstError.path}"`,
          `${firstError.message} under set up step`,
          $.step.position,
          $.app.name,
        )
      }

      throw error
    }
  },
}

export default action
