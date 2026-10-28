import { z } from 'zod'

import { MAILBOX_PATTERN } from './parameters'

export const dataOutSchema = z
  .object({
    status: z.array(
      z.enum([
        'ACCEPTED',
        'BLACKLISTED',
        'RATE-LIMITED',
        'INVALID-ATTACHMENT',
        'ATTACHMENT-SIZE-EXCEEDED',
        'INTERMITTENT-ERROR',
        'ERROR',
      ]),
    ),
    // Must accept the same addresses transactionalEmailSchema (parameters.ts)
    // accepts as input, or a partial-retry's dataOut fails to parse here and
    // resends to every recipient, not just the ones that failed.
    recipient: z.array(
      z.string().email({ pattern: MAILBOX_PATTERN }).toLowerCase(),
    ),
    body: z.string().optional(),
    subject: z.string().optional(),
    from: z.string().optional(),
    reply_to: z.string().email({ pattern: MAILBOX_PATTERN }).optional(),
  })
  .describe('Data out object for send transactional email')

export type PostmanEmailDataOut = z.infer<typeof dataOutSchema>

export type PostmanEmailSendStatus = PostmanEmailDataOut['status'][number]
