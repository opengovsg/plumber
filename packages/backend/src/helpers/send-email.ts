import axios from 'axios'

import app from '@/config/app'

export interface PostmanEmailRequestBody {
  subject: string
  body: string
  recipient: string
  replyTo?: string
}

export async function sendEmail(
  request: PostmanEmailRequestBody,
): Promise<void> {
  if (!app.postmanApiKey) {
    throw new Error('Missing POSTMAN_API_KEY')
  }
  await axios.post(
    'https://api.postman.gov.sg/v1/transactional/email/send',
    {
      subject: request.subject,
      body: request.body,
      recipient: request.recipient,
      from: 'Plumber via Postman<donotreply@mail.postman.gov.sg>',
      ...(request.replyTo && { reply_to: request.replyTo }),
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${app.postmanApiKey}`,
      },
    },
  )
}
