import axios from 'axios'

import app from '@/config/app'

export async function sendEmail({
  subject,
  body,
  recipient,
}: {
  subject: string
  body: string
  recipient: string
}): Promise<void> {
  if (!app.postmanApiKey) {
    throw new Error('Missing POSTMAN_API_KEY')
  }
  await axios.post(
    'https://api.postman.gov.sg/v1/transactional/email/send',
    {
      subject,
      body,
      recipient,
      from: 'Plumber via Postman<donotreply@mail.postman.gov.sg>',
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${app.postmanApiKey}`,
      },
    },
  )
}
