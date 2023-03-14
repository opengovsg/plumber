import axios from 'axios'

const POSTMAN_API_KEY = process.env.POSTMAN_API_KEY

export async function sendEmail({
  subject,
  body,
  recipient,
}: {
  subject: string
  body: string
  recipient: string
}): Promise<void> {
  if (!POSTMAN_API_KEY) {
    throw new Error('Missing POSTMAN_API_KEY')
  }
  await axios.post(
    'https://api.postman.gov.sg/v1/transactional/email/send',
    {
      subject,
      body,
      recipient,
      from: 'Zap via Postman<donotreply@mail.postman.gov.sg>',
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${POSTMAN_API_KEY}`,
      },
    },
  )
}
