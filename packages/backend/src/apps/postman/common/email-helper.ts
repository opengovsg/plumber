import { IHttpClient } from '@plumber/types'

import { SendEmailCommand } from '@aws-sdk/client-sesv2'
import FormData from 'form-data'
import { sortBy } from 'lodash'

import appConfig from '@/config/app'
import HttpError from '@/errors/http'
import { getLdFlagValue } from '@/helpers/launch-darkly'
import { getSesClient, shouldUseSes } from '@/helpers/ses-email-helper'

import {
  PostmanEmailDataOut,
  PostmanEmailSendStatus,
} from './data-out-validator'
import { getPostmanErrorStatus, getSesErrorStatus } from './throw-errors'

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
  ccList?: string[]
}

interface PromiseFulfilled {
  status: 'ACCEPTED'
  recipient: string
  params: Omit<PostmanEmailDataOut, 'status' | 'recipient'>
}

interface PromiseRejected {
  status: PostmanEmailSendStatus
  recipient: string
  error: HttpError
}

async function sendViaPostman(
  http: IHttpClient,
  recipientEmail: string,
  email: Email,
): Promise<PromiseFulfilled> {
  const requestData = new FormData()
  requestData.append('subject', email.subject)
  requestData.append('body', email.body)
  requestData.append('recipient', recipientEmail)
  requestData.append(
    'from',
    `${email.senderName} <${appConfig.postman.fromAddress}>`,
  )
  requestData.append('disable_tracking', 'true')
  if (email.ccList?.length > 0) {
    requestData.append('cc', JSON.stringify(email.ccList))
  }

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
      ...(email.ccList?.length && { cc: email.ccList }),
    },
  }
}

async function sendViaSes(
  recipientEmail: string,
  email: Email,
): Promise<PromiseFulfilled> {
  const client = getSesClient()
  const fromAddress = `Plumber <${appConfig.ses.fromAddress}>`

  await client.send(
    new SendEmailCommand({
      FromEmailAddress: fromAddress,
      Destination: {
        ToAddresses: [recipientEmail],
        ...(email.ccList?.length && { CcAddresses: email.ccList }),
      },
      Content: {
        Simple: {
          Subject: { Data: email.subject, Charset: 'UTF-8' },
          Body: {
            Html: { Data: email.body, Charset: 'UTF-8' },
          },
        },
      },
      ...(email.replyTo && { ReplyToAddresses: [email.replyTo] }),
      ...(appConfig.ses.configurationSet && {
        ConfigurationSetName: appConfig.ses.configurationSet,
      }),
    }),
  )

  return {
    status: 'ACCEPTED',
    recipient: recipientEmail,
    params: {
      body: email.body,
      subject: email.subject,
      from: fromAddress,
      reply_to: email.replyTo,
      ...(email.ccList?.length && { cc: email.ccList }),
    },
  }
}

export async function sendTransactionalEmails(
  http: IHttpClient,
  recipients: string[],
  email: Email,
): Promise<{
  dataOut: PostmanEmailDataOut
  errorStatus?: PostmanEmailSendStatus
  error?: HttpError
}> {
  const sesEnabledDomains = await getLdFlagValue<string[]>(
    'ses_enabled_domains',
    null,
    [],
  )

  // Use SES only if ALL recipients are in SES-enabled domains and no
  // attachments (SES Phase 1 does not support attachments). Otherwise,
  // send everything via Postman to avoid mixed error-handling paths.
  const useSes =
    !email.attachments?.length &&
    recipients.every((r) => shouldUseSes(r, sesEnabledDomains))

  const promises = recipients.map(async (recipientEmail) => {
    try {
      if (useSes) {
        return await sendViaSes(recipientEmail, email)
      }
      return await sendViaPostman(http, recipientEmail, email)
    } catch (e) {
      throw {
        status: useSes ? getSesErrorStatus(e) : getPostmanErrorStatus(e),
        recipient: recipientEmail,
        error: e,
      } satisfies PromiseRejected
    }
  })

  const results = await Promise.allSettled(promises)
  const status: PostmanEmailSendStatus[] = []
  const recipient: string[] = []
  let params: Omit<PostmanEmailDataOut, 'status' | 'recipient'>
  const errors: PromiseRejected[] = []

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      status.push(result.value.status)
      recipient.push(result.value.recipient)
      if (!params) {
        params = result.value.params
      }
    } else {
      status.push(result.reason.status)
      recipient.push(result.reason.recipient)
      errors.push(result.reason)
    }
  })

  /**
   * Since we can only return one error per step, we select by priority:
   * 1. RATE-LIMITED (so we can auto-retry)
   * 2. INVALID-ATTACHMENT (probably all recipients should fail)
   * 3. ATTACHMENT-SIZE-EXCEEDED (probably all recipients should fail)
   * 4. INTERMITTENT-ERROR (some recipients failed, auto-retry)
   * 5. ERROR (probably all recipients should fail)
   * 6. BLACKLISTED (blacklisted errors are returned even if there are other errors)
   */
  const sortedErrors = sortBy(errors, (error) =>
    [
      'RATE-LIMITED',
      'INVALID-ATTACHMENT',
      'ATTACHMENT-SIZE-EXCEEDED',
      'INTERMITTENT-ERROR',
      'ERROR',
      'BLACKLISTED',
    ].indexOf(error.status),
  )

  const dataOut = {
    status,
    recipient,
    ...params,
  } satisfies PostmanEmailDataOut
  return {
    dataOut,
    error: sortedErrors.length ? sortedErrors[0].error : undefined,
    errorStatus: sortedErrors.length ? sortedErrors[0].status : undefined,
  }
}
