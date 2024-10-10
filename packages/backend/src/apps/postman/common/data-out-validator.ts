import { z } from 'zod'

export const dataOutSchema = z.object(
  {
    status: z.array(
      z.enum([
        'ACCEPTED',
        'BLACKLISTED',
        'RATE-LIMITED',
        'INVALID-ATTACHMENT',
        'INTERMITTENT-ERROR',
        'ERROR',
      ]),
    ),
    recipient: z.array(z.string().email().toLowerCase()),
    body: z.string().optional(),
    subject: z.string().optional(),
    from: z.string().optional(),
    reply_to: z.string().email().optional(),
  },
  {
    description: 'Data out object for send transactional email',
  },
)

export type PostmanEmailDataOut = z.infer<typeof dataOutSchema>

export type PostmanEmailSendStatus = PostmanEmailDataOut['status'][number]
