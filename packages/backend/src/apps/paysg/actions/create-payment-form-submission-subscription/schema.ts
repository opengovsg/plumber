import emailValidator from 'email-validator'
import { z } from 'zod'

import { requestSchema as createPaymentFormSubmissionRequestSchema } from '../create-payment-form-submission/schema'

export const requestSchema = createPaymentFormSubmissionRequestSchema.extend({
  description: z
    .string({ invalid_type_error: 'Empty description' })
    .trim()
    .min(1, { message: 'Specify a description' })
    .max(500, { message: 'Description cannot be more than 500 characters' }),
  frequency: z.literal('monthly'),
  payer_email: z
    .string({ invalid_type_error: 'Empty payer email' })
    .trim()
    .max(255, { message: 'Payer email cannot be more than 255 characters' })
    .transform((value, context) => {
      if (!emailValidator.validate(value)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid payer email',
        })
        return z.NEVER
      }

      return value
    }),
})
