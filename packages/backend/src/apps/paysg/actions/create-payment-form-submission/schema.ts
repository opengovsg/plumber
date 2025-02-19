import emailValidator from 'email-validator'
import { z } from 'zod'

import { FORM_ID_LENGTH } from '@/apps/formsg/common/constants'

import { normalizeSpecialChars } from '../create-payment/normalize-special-chars'

const PAYMENT_FORM_LINK_REGEX = /^https:\/\/(staging.)?pay.gov.sg\/forms\/(.*)$/

export const requestSchema = z.object({
  formId: z
    .string()
    .trim()
    .min(1, { message: 'Specify a form link' })
    .transform((value, context) => {
      const match = value.match(PAYMENT_FORM_LINK_REGEX)

      if (!match || !match[0]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid payment form link',
        })
        return z.NEVER
      }

      return match[2]
    }),
  formsg_form_id: z
    .string()
    .trim()
    .length(FORM_ID_LENGTH, { message: 'Specify a valid FormSG form ID' }),
  formsg_submission_id: z
    .string()
    .trim()
    .min(1, { message: 'Specify a submission ID' }),
  nonce: z.string().trim().min(1, { message: 'Specify a nonce field' }),
  payer_name: z
    .string()
    .trim()
    .min(1, { message: 'Empty payer name' })
    .max(255, { message: 'Payer name cannot be more than 255 characters' })
    .transform((value) => normalizeSpecialChars(value)),
  payer_email: z
    .string()
    .trim()
    .max(255, { message: 'Payer email cannot be more than 255 characters' })
    .transform((value, context) => {
      if (!value || value.length === 0) {
        return undefined
      }
      if (!emailValidator.validate(value)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid payer email',
        })
        return z.NEVER
      }

      return value
    })
    .optional(),
  amount_in_cents: z
    .string()
    .trim()
    .min(1, { message: 'Empty payment amount' })
    .pipe(
      z.coerce
        .number()
        .int('Payment amount must be round number')
        .min(50, { message: 'Payment amount must be larger than 50 cents' })
        .max(99999999, {
          message: 'Payment amount cannot be larger than $999999.99',
        }),
    ),
  description: z
    .string()
    .trim()
    .max(500, { message: 'Description cannot be more than 500 characters' })
    .transform((value) => value || undefined)
    .optional(),
  responses: z.array(
    z.object({
      question: z.string().trim().min(1, { message: 'Empty question' }),
      answer: z.string().trim().min(1, { message: 'Empty answer' }),
    }),
  ),
})
