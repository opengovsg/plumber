import { IField } from '@plumber/types'

import validator from 'email-validator'
import { z } from 'zod'

import { parseS3Id } from '@/helpers/s3'

function recipientStringToArray(value: string) {
  return value
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e?.length > 0)
}

export const transactionalEmailFields: IField[] = [
  {
    label: 'Subject',
    key: 'subject',
    type: 'string' as const,
    required: true,
    description: 'Email subject.',
    variables: true,
  },
  {
    label: 'Body',
    key: 'body',
    type: 'rich-text' as const,
    required: true,
    description:
      'Email body HTML. We are upgrading this field to a rich-text field, if you observe any issues while editing your existing pipes, please contact us via support@plumber.gov.sg',
    variables: true,
  },
  {
    label: 'Recipient Email',
    key: 'destinationEmail',
    type: 'string' as const,
    required: true,
    description: 'Recipient email addresses, comma-separated.',
    variables: true,
  },
  {
    label: 'Reply-To Email',
    key: 'replyTo',
    type: 'string' as const,
    required: false,
    description: 'Reply-to email',
    variables: true,
  },
  {
    label: 'Sender Name',
    key: 'senderName',
    type: 'string' as const,
    required: true,
    variables: true,
  },
  {
    label: 'Attachments',
    key: 'attachments',
    description:
      'Find out more about supported file types [here](https://guide.postman.gov.sg/email-api-guide/programmatic-email-api/send-email-api/attachments#list-of-supported-attachment-file-types).',
    type: 'multiselect' as const,
    required: false,
    variables: true,
    variableTypes: ['file'],
  },
]

export const transactionalEmailSchema = z.object({
  subject: z.string().min(1, { message: 'Empty subject' }).trim(),
  body: z
    .string()
    .min(1, { message: 'Empty body' })
    // for backward-compatibility with content produced by the old editor
    .transform((v) => v.replace(/\n/g, '<br>')),
  destinationEmail: z.string().transform((value, ctx) => {
    const recipients = recipientStringToArray(value)
    if (recipients.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Empty recipient email',
      })
    }
    if (recipients.some((recipient) => !validator.validate(recipient))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid recipient emails',
      })
    }
    return recipients
  }),
  replyTo: z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value
    }
    return value.trim() === '' ? undefined : value.trim()
  }, z.string().email({ message: 'Invalid reply to email' }).optional()),
  senderName: z.string().min(1, { message: 'Empty sender name' }).trim(),
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
