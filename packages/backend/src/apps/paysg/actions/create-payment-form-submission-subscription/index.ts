import type { IRawAction } from '@plumber/types'
import { fromZodError } from 'zod-validation-error'

import StepError, { GenericSolution } from '@/errors/step'

import { rethrowAsPaySgStepError } from '../../common/paysg-http-error'
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
      required: true,
      variables: true,
    },
    {
      label: 'Payer Address',
      key: 'payer_address',
      type: 'string' as const,
      required: false,
      variables: true,
    },
    {
      label: 'Payer Identifier',
      key: 'payer_identifier',
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

    const request = requestSchema.safeParse($.step.parameters)
    if (!request.success) {
      const firstError = fromZodError(request.error).details[0]
      throw new StepError({
        name: `${firstError.message} under set up step`,
        solution: GenericSolution.ReconfigureInvalidField,
        kind: 'config',
      })
    }

    const { formId, ...body } = request.data
    await $.http
      .post(
        `/v1/payment-services/:paymentServiceId/forms/:formId/subscription-submissions`,
        body,
        {
          urlPathParams: {
            paymentServiceId,
            formId,
          },
        },
      )
      .catch(rethrowAsPaySgStepError)
    $.setActionItem({ raw: { success: true } })
  },
}

export default action
