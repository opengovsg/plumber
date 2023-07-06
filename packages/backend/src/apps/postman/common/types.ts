import validator from 'email-validator'
import { z } from 'zod'

const recipientStringToArray = (value: string) =>
  value
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e?.length > 0)

export const emailSchema = z.object({
  destinationEmail: z.string().transform((value, ctx) => {
    const recipients = recipientStringToArray(value)
    if (recipients.some((recipient) => !validator.validate(recipient))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid recipient emails',
      })
    }
    return recipients
  }),
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
