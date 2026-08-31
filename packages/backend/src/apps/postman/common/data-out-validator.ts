import { z } from 'zod'

const postmanEmailSendStatusSchema = z.enum([
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
    status: z.array(postmanEmailSendStatusSchema),
    recipient: z.array(z.string().email().toLowerCase()),
    body: z.string().optional(),
    subject: z.string().optional(),
    from: z.string().optional(),
    reply_to: z.string().email().optional(),
    cc: z.array(z.string().email().toLowerCase()).optional(),
    // Aligned with `cc` — only populated on the SES path, since CC suppression
    // is an SES-only concept (the Postman path doesn't check suppression).
    ccStatus: z.array(postmanEmailSendStatusSchema).optional(),
  })
  .describe('Data out object for send transactional email')

export type PostmanEmailDataOut = z.infer<typeof dataOutSchema>

export type PostmanEmailSendStatus = PostmanEmailDataOut['status'][number]
