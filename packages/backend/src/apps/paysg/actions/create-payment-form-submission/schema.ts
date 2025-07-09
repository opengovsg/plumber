import emailValidator from 'email-validator'
import { z } from 'zod'

import { FORM_ID_LENGTH } from '@/apps/formsg/common/constants'

import { normalizeSpecialChars } from '../create-payment/normalize-special-chars'

const PAYMENT_FORM_LINK_REGEX = /^https:\/\/(staging.)?pay.gov.sg\/forms\/(.*)$/

export const requestSchema = z.object({
  formId: z
    .string({ invalid_type_error: 'Empty payment form link' })
    .trim()
    .min(1, { message: 'Specify a payment form link' })
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
    .string({ invalid_type_error: 'Empty FormSG form ID' })
    .trim()
    .length(FORM_ID_LENGTH, { message: 'Specify a valid FormSG form ID' }),
  formsg_submission_id: z
    .string({ invalid_type_error: 'Empty FormSG submission ID' })
    .trim()
    .min(1, { message: 'Specify a submission ID' }),
  nonce: z
    .string({ invalid_type_error: 'Empty FormSG reference field answer' })
    .trim()
    .min(1, { message: 'Specify a FormSG reference field answer' }),
  payer_name: z
    .string({ invalid_type_error: 'Empty payer name' })
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
  payer_address: z
    .string()
    .trim()
    .transform((value) => value || undefined)
    .optional(),
  payer_identifier: z
    .string()
    .trim()
    .transform((value) => value || undefined)
    .optional(),
  amount_in_cents: z
    .string()
    .trim()
    .min(1, { message: 'Empty payment amount' })
    .pipe(
      z.coerce
        .number({
          invalid_type_error: 'Payment amount must be a number',
        })
        .int('Payment amount must be a round number')
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
  responses: z
    .array(
      z.object({
        question: z
          .string({ invalid_type_error: 'Empty question' })
          .trim()
          .min(1, { message: 'Empty question' }),
        answer: z
          .string({ invalid_type_error: 'Empty answer' })
          .trim()
          .min(1, { message: 'Empty answer' }),
      }),
    )
    .default([]),
})
