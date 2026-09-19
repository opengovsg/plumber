import { z } from 'zod'

import { MAILBOX_PATTERN } from './parameters'

const sendStatusSchema = z.enum([
  'ACCEPTED',
  'BLACKLISTED',
  'RATE-LIMITED',
  'INVALID-ATTACHMENT',
  'ATTACHMENT-SIZE-EXCEEDED',
  'INTERMITTENT-ERROR',
  'ERROR',
])

export const dataOutSchema = z
  .object({
    status: z.array(sendStatusSchema),
    recipient: z.array(
      z.string().email({ pattern: MAILBOX_PATTERN }).toLowerCase(),
    ),
    // Aligned arrays like status/recipient. Only the SES path tracks CC status,
    // so both stay optional.
    cc: z.array(z.string().email().toLowerCase()).optional(),
    ccStatus: z.array(sendStatusSchema).optional(),
    body: z.string().optional(),
    subject: z.string().optional(),
    from: z.string().optional(),
    reply_to: z.string().email({ pattern: MAILBOX_PATTERN }).optional(),
  })
  .describe('Data out object for send transactional email')

export type PostmanEmailDataOut = z.infer<typeof dataOutSchema>

export type PostmanEmailSendStatus = PostmanEmailDataOut['status'][number]
