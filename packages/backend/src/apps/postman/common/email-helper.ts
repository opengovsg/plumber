import { IHttpClient } from '@plumber/types'

import FormData from 'form-data'
import { sortBy } from 'lodash'

import appConfig from '@/config/app'
import HttpError from '@/errors/http'

import {
  getPostmanErrorStatus,
  type PostmanEmailSendStatus,
} from './throw-errors'

const ENDPOINT = '/v1/transactional/email/send'

interface SendTransactionalEmailResponse {
  id: string
  from: string
  recipient: string
  params: {
    body: string
    from: string
    subject: string
    reply_to: string
  }
  attachments_metadata:
    | {
        fileName: string
        fileSize: number
        hash: string
      }[]
    | null
  status:
    | 'UNSENT'
    | 'ACCEPTED'
    | 'SENT'
    | 'BOUNCED'
    | 'DELIVERED'
    | 'OPENED'
    | 'COMPLAINT'
  error_code: string | null
  error_sub_type: string | null
  created_at: string
  updated_at: string | null
  accepted_at: string | null
  sent_at: string | null
  delivered_at: string | null
  opened_at: string | null
}

interface Email {
  subject: string
  body: string
  senderName: string
  attachments?: { fileName: string; data: Uint8Array }[]
  replyTo?: string
}

export interface SendTrasactionEmailDataOut {
  status: PostmanEmailSendStatus[]
  recipient: string[]
  body?: string
  subject?: string
  from?: string
  reply_to?: string
}

interface PostmanPromiseFulfilled {
  status: 'ACCEPTED'
  recipient: string
  params: Omit<SendTrasactionEmailDataOut, 'status' | 'recipient'>
}

interface PostmanPromiseRejected {
  status: PostmanEmailSendStatus
  recipient: string
  error: HttpError
}

export async function sendTransactionalEmails(
  http: IHttpClient,
  recipients: string[],
  email: Email,
): Promise<{
  dataOut: SendTrasactionEmailDataOut
  errorStatus?: PostmanEmailSendStatus
  error?: HttpError
}> {
  const promises = recipients.map(async (recipientEmail) => {
    const requestData = new FormData()
    requestData.append('subject', email.subject)
    requestData.append('body', email.body)
    requestData.append('recipient', recipientEmail)
    requestData.append(
      'from',
      `${email.senderName} <${appConfig.postman.fromAddress}>`,
    )
    requestData.append('disable_tracking', 'true')

    if (email.replyTo) {
      requestData.append('reply_to', email.replyTo)
    }

    for (const attachment of email.attachments ?? []) {
      requestData.append(
        'attachments',
        Buffer.from(attachment.data),
        attachment.fileName,
      )
    }

    try {
      const response = await http.post<SendTransactionalEmailResponse>(
        ENDPOINT,
        requestData,
        {
          headers: {
            ...requestData.getHeaders(),
            Authorization: `Bearer ${appConfig.postman.apiKey}`,
          },
        },
      )
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const { body, subject, from, reply_to } = response.data.params
      return {
        status: 'ACCEPTED',
        recipient: recipientEmail,
        params: {
          body,
          subject,
          from,
          reply_to,
        },
      } satisfies PostmanPromiseFulfilled
    } catch (e) {
      throw {
        status: getPostmanErrorStatus(e),
        recipient: recipientEmail,
        error: e,
      } satisfies PostmanPromiseRejected
    }
  })

  const results = await Promise.allSettled(promises)
  const status: PostmanEmailSendStatus[] = []
  const recipient: string[] = []
  let params: Omit<SendTrasactionEmailDataOut, 'status' | 'recipient'>
  const errors: PostmanPromiseRejected[] = []

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      status.push(result.value.status)
      recipient.push(result.value.recipient)
      if (!params) {
        // params will be same for all successful recipients
        //  so we store the first params only
        params = result.value.params
      }
    } else {
      status.push(result.reason.status)
      recipient.push(result.reason.recipient)
      errors.push(result.reason)
    }
  })

  /**
   * Since we can only return one error per postman step, we have to select in terms of priority
   * 1. RATE-LIMITED (so we can auto-retry)
   * 2. BLACKLISTED (so they can manual-retry)
   * 3. INVALID-ATTACHMENT (probably all recipients should fail)
   * 4. ERROR (same as above, probably all recipients should fail)
   */
  const sortedErrors = sortBy(errors, (error) =>
    ['RATE-LIMITED', 'BLACKLISTED', 'INVALID-ATTACHMENT', 'ERROR'].indexOf(
      error.status,
    ),
  )

  const dataOut = {
    status,
    recipient,
    ...params,
  } satisfies SendTrasactionEmailDataOut
  return {
    dataOut,
    error: sortedErrors.length ? sortedErrors[0].error : undefined,
    errorStatus: sortedErrors.length ? sortedErrors[0].status : undefined,
  }
}
