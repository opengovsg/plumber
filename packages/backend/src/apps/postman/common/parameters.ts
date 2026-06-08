import { IField } from '@plumber/types'

import validator from 'email-validator'
import { uniq } from 'lodash'
import { z } from 'zod'

import appConfig from '@/config/app'
import { parseS3Id } from '@/helpers/s3'

import { POSTMAN_SUPPORTED_ATTACHMENTS_GUIDE_URL } from './constants'

function recipientStringToArray(value: string) {
  const recipientArray = value
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e?.length > 0)
  // dedupe the array
  return uniq(recipientArray)
}

function validateEmails(value: string, ctx: z.RefinementCtx, msg: string) {
  const recipients = recipientStringToArray(value)
  if (recipients.some((recipient) => !validator.validate(recipient))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: msg,
    })
  }
  return recipients
}

export const transactionalEmailFields: IField[] = [
  {
    label: 'Email subject',
    key: 'subject',
    type: 'string' as const,
    required: true,
    variables: true,
  },
  {
    label: 'Body',
    key: 'body',
    type: 'rich-text' as const,
    required: true,
    variables: true,
    variableTypes: [
      'text',
      'array',
      'tile_row_id',
      'approval',
      'ai_response',
      'table',
    ],
    supportTableDisplay: true,
  },
  {
    label: 'Recipient email(s)',
    key: 'destinationEmail',
    type: 'string' as const,
    required: true,
    description:
      'Enter the email addresses of the main recipients, separated by commas.\nEach recipient will receive an individual email.',
    variables: true,
  },
  {
    label: 'CC recipient email(s)',
    key: 'destinationEmailCc',
    type: 'string' as const,
    required: false,
    description:
      'Enter the email addresses to CC, separated by commas.\nCC recipients will receive a copy of the email for each main recipient.',
    tooltipText:
      'CC recipient status is not tracked. Blacklisted CC recipients will be ignored, but the email will still be sent to other recipients.',
    variables: true,
  },
  {
    label: 'Sender name',
    key: 'senderName',
    type: 'string' as const,
    required: true,
    description: 'For e.g., HR department.',
    variables: true,
  },
  {
    label: 'Reply-To email',
    key: 'replyTo',
    type: 'string' as const,
    required: false,
    description:
      'If left blank, this will default to your email address. Only one email address is allowed.',
    variables: true,
  },
  {
    label: 'Attachments',
    key: 'attachments',
    description: `Check supported file types [here](${POSTMAN_SUPPORTED_ATTACHMENTS_GUIDE_URL}).\nPlease note that the maximum file size for each file is 2MB, and the total size of all attachments cannot exceed 10MB.`,
    type: 'attachment' as const,
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
  destinationEmail: z
    .string()
    .transform((value, ctx) =>
      validateEmails(value, ctx, 'Invalid recipient emails'),
    ),
  destinationEmailCc: z
    .string()
    .transform((value, ctx) => validateEmails(value, ctx, 'Invalid CC emails'))
    /**
     * NOTE: Postman limits a maximum of 50 recipients (including primary recipient and CC recipients)
     * Currently, Plumber sends emails to the main recipient individually,
     * hence a limit of 49 CC recipients is enforced.
     */
    .refine((value) => value.length <= 49, {
      message: 'The total number of CC recipient emails must not exceed 49',
    })
    .optional(),
  replyTo: z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return value
      }
      return value.trim() === '' ? undefined : value.trim()
    },
    z
      .string()
      .refine((value) => validator.validate(value), {
        message: 'Invalid reply to email',
      })
      .optional(),
  ),
  senderName: z
    .string()
    .min(1, { message: 'Empty sender name' })
    .trim()
    // Strip characters that would break the RFC 5322 display name in the
    // constructed "{senderName} <info@plumber.gov.sg>" address. A value like
    // "Foo <x@y.com>" otherwise yields a malformed address that SES rejects
    // (Postman happens to tolerate it). Collapse the resulting whitespace so
    // stripped characters don't leave double spaces.
    .transform((value) =>
      value
        .replace(/[\r\n<>"]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    // NOTE: we trim the sender name so that long sender names do not cause the email to fail.
    // Postman limits the sender name to 255 characters.
    // the API sends "{senderName} <info@plumber.gov.sg>" so it needs to be included in the calculation.
    .transform((value) =>
      value.substring(0, 255 - ` <${appConfig.postman.fromAddress}>`.length),
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
