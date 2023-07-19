import validator from 'email-validator'
import { z } from 'zod'

import { parseS3Id } from '@/helpers/s3'

const recipientStringToArray = (value: string) =>
  value
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e?.length > 0)

export const parametersSchema = z.object({
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
  fromAddress: z.nullable(
    z
      .string()
      .trim()
      .transform((email, context) => {
        if (!email) {
          return null
        }
        if (!validator.validate(email)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Invalid sender email',
          })
          return z.NEVER
        }
        return email
      }),
  ),
  attachments: z.array(z.string()).transform((array, context) => {
    const result: string[] = []

    for (const value of array) {
      // Account for optional attachment fields with no response.
      if (!value) {
        continue
      }

      if (!parseS3Id(value)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${value} is not a S3 ID.`,
        })
        return z.NEVER
      }

      result.push(value)
    }

    return result
  }),
})
