import { z } from 'zod'

import { requestSchema as createPaymentFormSubmissionRequestSchema } from '../create-payment-form-submission/schema'

export const requestSchema = createPaymentFormSubmissionRequestSchema.extend({
  description: z
    .string({ invalid_type_error: 'Empty description' })
    .trim()
    .min(1, { message: 'Specify a description' })
    .max(500, { message: 'Description cannot be more than 500 characters' }),
  frequency: z.literal('monthly'),
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
})
