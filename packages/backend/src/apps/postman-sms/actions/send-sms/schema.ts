import z from 'zod'

// From Postman API docs
// https://postman-v2.guides.gov.sg/faq/postman-v2-api-faq/campaign-related-inquiries
export const MAX_SMS_CHARS = 1000

const telephoneNumberSchema = z
  .string()
  .trim()
  .min(1, { message: 'Enter a phone number' })
  // Also allow dash, brackets and spaces, which are commonly used as spacers in
  // phone numbers. We'll strip them out later.
  .regex(/^\+?[\d \-()]+$/g, 'Enter a valid phone number')
  .transform((phoneNumber) => phoneNumber.replaceAll(/[^\d]/g, ''))

export const fieldSchema = z.object({
  recipient: telephoneNumberSchema,
  message: z
    .string()
    .trim()
    .min(1, { message: 'Provide a non-empty message' })
    .max(MAX_SMS_CHARS, {
      message: `Message cannot exceed ${MAX_SMS_CHARS.toLocaleString()} characters`,
    }),
})

// Subset of the full reply; the other fields are not needed.
// https://postman-v2.guides.gov.sg/endpoints-for-api-users/single-send
export const postmanMessageSchema = z.object({
  createdAt: z.string().datetime({ offset: true }),
  id: z.string(),
})
