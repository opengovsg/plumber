import { IField } from '@plumber/types'

import { uniq } from 'lodash'
import { z } from 'zod'

import appConfig from '@/config/app'
import { parseS3Id } from '@/helpers/s3'

import { POSTMAN_SUPPORTED_ATTACHMENTS_GUIDE_URL } from './constants'

// Keep the RFC 5321 mailbox length cap. Skip the 64-char local-part cap so
// plus-tagged routing addresses still parse.
const MAX_MAILBOX_LENGTH = 254
const mailboxSchema = z.email().max(MAX_MAILBOX_LENGTH)

function isValidMailbox(email: string): boolean {
  return mailboxSchema.safeParse(email).success
}
export const SEND_MODE_KEY = 'sendMode'

export const sendModeSchema = z.enum(['combined', 'individual'])

export type SendMode = z.infer<typeof sendModeSchema>

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
  if (recipients.some((recipient) => !isValidMailbox(recipient))) {
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
    previewType: 'email' as const,
  },
  {
    label: 'Recipient email(s)',
    key: 'destinationEmail',
    type: 'string' as const,
    required: true,
    variables: true,
    tabs: {
      key: SEND_MODE_KEY,
      value: 'combined' satisfies SendMode,
      options: [
        {
          label: 'One email to all',
          value: 'combined' satisfies SendMode,
          description:
            'Sent as one email with everyone in To/CC. Each recipient will see the full list of who else received it.',
        },
        {
          label: 'Individual email to each recipient',
          value: 'individual' satisfies SendMode,
          description:
            'Sent as separate emails, one per recipient. No one sees who else received it.\nCC recipients will receive a copy of the email for each main recipient.',
        },
      ],
    },
  },
  {
    label: 'CC recipient email(s)',
    key: 'destinationEmailCc',
    type: 'string' as const,
    required: false,
    description: 'Enter the email addresses to CC, separated by commas.',
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
    description: `Check supported file types [here](${POSTMAN_SUPPORTED_ATTACHMENTS_GUIDE_URL}).\nPlease note that the total size of all attachments cannot exceed 20MB.`, // TODO: update the guide on the supported file types
    type: 'attachment' as const,
    required: false,
    variables: true,
    variableTypes: ['file'],
  },
]

export const transactionalEmailSchema = z.object({
  // Steps created before this field existed carry `individual`, injected by the
  // step transformer. Only steps saved without the key fall through to the
  // default, which is the behaviour new steps get.
  [SEND_MODE_KEY]: sendModeSchema.default('combined'),
  subject: z
    .string()
    .min(1, { message: 'Empty subject' })
    .trim()
    // Collapse whitespace so newlines (which can't appear in a header) become
    // spaces — keeps the subject single-line and avoids header injection.
    .transform((value) => value.replace(/\s+/g, ' ').trim()),
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
      .refine((value) => isValidMailbox(value), {
        message: 'Invalid reply to email',
      })
      .optional(),
  ),
  senderName: z
    .string()
    .min(1, { message: 'Empty sender name' })
    .trim()
    // Collapse whitespace so newlines (which can't appear in an email header)
    // become spaces — prevents header injection (e.g. "Foo\r\nBcc: evil@x.com").
    // Display-name specials like commas/angle brackets are preserved; they're
    // RFC 5322-quoted when the From address is built (see formatFromAddress).
    .transform((value) => value.replace(/\s+/g, ' ').trim())
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
