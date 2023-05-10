import validator from 'email-validator'
import { z } from 'zod'

export const emailSchema = z.object({
  destinationEmail: z
    .custom(
      (value) => {
        if (!value || typeof value !== 'string' || !value.length) {
          return false
        }
        const recipients = value.split(',').map((e) => e.trim())
        if (recipients.some((recipient) => !validator.validate(recipient))) {
          return false
        }
        return true
      },
      { message: 'Invalid recipient email' },
    )
    .transform((value: string) => value.split(',').map((e) => e.trim())),
  subject: z.string().min(1).trim(),
  body: z
    .string()
    .min(1)
    // convert \n to <br> for HTML emails
    .transform((value) => value.replace(/\n/g, '<br>')),
  replyTo: z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value
    }
    return value.trim() === '' ? undefined : value.trim()
  }, z.string().email().optional()),
  senderName: z.string().min(1).trim(),
})
