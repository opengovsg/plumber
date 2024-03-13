import axios from 'axios'

import appConfig from '@/config/app'
import HttpError from '@/errors/http'

import logger from './logger'

export interface PostmanEmailRequestBody {
  subject: string
  body: string
  recipient: string
  replyTo?: string
}

export async function sendEmail({
  subject,
  body,
  recipient,
  replyTo,
}: PostmanEmailRequestBody): Promise<void> {
  try {
    await axios.post(
      'https://api.postman.gov.sg/v1/transactional/email/send',
      {
        subject,
        body,
        recipient,
        from: `Plumber <${appConfig.postman.fromAddress}>`,
        ...(replyTo && { reply_to: replyTo }),
        disable_tracking: true,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${appConfig.postman.apiKey}`,
        },
      },
    )
  } catch (e) {
    let errorMsg = 'Error sending email. Please try again later.'
    if (axios.isAxiosError(e)) {
      logger.error('Error sending email', { error: new HttpError(e).response })
      errorMsg = e.response?.data?.message ?? e.message

      // User has been added to Postman's blacklist, we need to contact them to remove it
      if (errorMsg.includes('blacklisted')) {
        logger.info('Blacklisted email', { email: recipient })
        errorMsg =
          'Your email may be blocked. Contact us at support@open.gov.sg'
      }
    }
    throw new Error(errorMsg)
  }
}
