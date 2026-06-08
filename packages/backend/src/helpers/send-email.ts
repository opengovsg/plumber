import axios from 'axios'

import appConfig from '@/config/app'
import HttpError from '@/errors/http'

import { getLdFlagValue } from './launch-darkly'
import logger from './logger'
import { sendEmailViaSes, shouldUseSes } from './ses-email-helper'

export interface PostmanEmailRequestBody {
  subject: string
  body: string
  recipient: string
  replyTo?: string
  cc?: string[]
}

async function sendEmailViaPostman({
  subject,
  body,
  recipient,
  replyTo,
  cc,
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
        ...(cc && { cc }),
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
      logger.error('Error sending email via Postman', {
        error: new HttpError(e).response,
      })
      errorMsg = e.response?.data?.message ?? e.message

      if (errorMsg.includes('blacklisted')) {
        logger.info('Blacklisted email', { email: recipient })
        errorMsg =
          'Your email may be blocked. Contact us at support@plumber.gov.sg'
      }
    }
    throw new Error(errorMsg)
  }
}

export async function sendEmail(
  params: PostmanEmailRequestBody,
): Promise<void> {
  const sesEnabledDomains = await getLdFlagValue<string[]>(
    'ses_enabled_domains',
    null,
    [],
  )
  if (shouldUseSes(params.recipient, sesEnabledDomains)) {
    return sendEmailViaSes(params)
  }

  return sendEmailViaPostman(params)
}
