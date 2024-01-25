import { IHttpClient } from '@plumber/types'

import FormData from 'form-data'

import appConfig from '@/config/app'

const ENDPOINT = '/v1/transactional/email/send'

export interface SendTransactionalEmailResponse {
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

export interface Email {
  subject: string
  body: string
  senderName: string
  attachments?: { fileName: string; data: Uint8Array }[]
  replyTo?: string
}

export async function sendTransactionalEmails(
  http: IHttpClient,
  recipients: string[],
  email: Email,
): Promise<SendTransactionalEmailResponse[]> {
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
    return response.data
  })

  return await Promise.all(promises)
}
