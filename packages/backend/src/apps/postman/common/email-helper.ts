import { IHttpClient } from '@plumber/types'

import { SendEmailCommand } from '@aws-sdk/client-sesv2'
import FormData from 'form-data'
import { sortBy } from 'lodash'

import appConfig from '@/config/app'
import HttpError from '@/errors/http'
import { getLdFlagValue } from '@/helpers/launch-darkly'
import logger from '@/helpers/logger'
import { incrementMetric } from '@/helpers/metrics'
import { sanitizeEmailHtml } from '@/helpers/sanitize-email-html'
import {
  formatFromAddress,
  getSesClient,
  shouldUseSes,
} from '@/helpers/ses-email-helper'
import EmailSuppressionEntry from '@/models/email-suppression-entry'

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

interface PostmanPromiseFulfilled {
  status: 'ACCEPTED'
  recipient: string
  params: Omit<PostmanEmailDataOut, 'status' | 'recipient'>
}

interface PostmanPromiseRejected {
  status: PostmanEmailSendStatus
  recipient: string
  error: HttpError
}

async function sendViaPostman(
  http: IHttpClient,
  recipientEmail: string,
  email: Email,
): Promise<PostmanPromiseFulfilled> {
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
  // CC addresses to actually send to. Suppressed CCs are dropped from the SES
  // call so we don't re-send to known-bad addresses (which would re-bounce and
  // inflate the bounce rate). The full email.ccList is still reported in
  // dataOut below — only the API call is filtered.
  ccAddressesToSend: string[] | undefined,
): Promise<PostmanPromiseFulfilled> {
  const client = getSesClient()
  // Address sent to SES: display name is RFC 5322-quoted when it contains
  // specials (e.g. a comma) so the header isn't malformed.
  const fromAddress = formatFromAddress(
    email.senderName,
    appConfig.ses.fromAddress,
  )
  // Human-readable form for dataOut — no quoting artifacts shown to the user.
  const displayFrom = `${email.senderName} <${appConfig.ses.fromAddress}>`

  await client.send(
    new SendEmailCommand({
      FromEmailAddress: fromAddress,
      Destination: {
        ToAddresses: [recipientEmail],
        ...(ccAddressesToSend?.length && { CcAddresses: ccAddressesToSend }),
      },
      Content: {
        Simple: {
          Subject: { Data: email.subject, Charset: 'UTF-8' },
          Body: {
            // SES sends the body verbatim; sanitise to match the server-side
            // filtering the Postman path gets for free.
            Html: { Data: sanitizeEmailHtml(email.body), Charset: 'UTF-8' },
          },
          // Marks the message as sent via the SES direct path (absent =>
          // routed through Postman). Recipient-invisible; for triage only.
          Headers: [{ Name: 'X-Plumber-Transport', Value: 'ses' }],
        },
      },
      ...(email.replyTo && { ReplyToAddresses: [email.replyTo] }),
      ...(appConfig.ses.configurationSet && {
        ConfigurationSetName: appConfig.ses.configurationSet,
      }),
    }),
  )
  incrementMetric('ses.email.sent')

  // TODO: remove this log once the SES rollout is verified and stable.
  logger.info('Postman step email sent via SES', {
    event: 'postman-step-ses-email-sent',
    subject: email.subject,
    from: fromAddress,
    recipient: recipientEmail,
    ccAddressesToSend,
  })

  return {
    status: 'ACCEPTED',
    recipient: recipientEmail,
    params: {
      body: email.body,
      subject: email.subject,
      from: displayFrom,
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

  // Pre-send suppression check (SES path only). CC addresses are included so a
  // blacklisted CC can be dropped from the SES call rather than re-sent to
  // (which would re-bounce and inflate the bounce rate). CC suppression is
  // silent — the full ccList is still reported in dataOut.
  let suppressedSet = new Set<string>()
  if (useSes) {
    const suppressedEmails = await EmailSuppressionEntry.getSuppressedEmails([
      ...recipients,
      ...(email.ccList ?? []),
    ])
    suppressedSet = new Set(suppressedEmails)

    if (suppressedSet.size > 0) {
      logger.info('Suppressed emails filtered out before sending', {
        event: 'pre-send-suppression-check',
        suppressedCount: suppressedSet.size,
        totalRecipients: recipients.length,
      })
    }
  }

  const activeRecipients = recipients.filter((r) => !suppressedSet.has(r))
  // Suppressed CCs are removed from the API call only — dataOut keeps the full
  // ccList (CC status is not tracked per the field's documented behaviour).
  const ccAddressesToSend = email.ccList?.filter((cc) => !suppressedSet.has(cc))

  const promises = activeRecipients.map(async (recipientEmail) => {
    try {
      if (useSes) {
        return await sendViaSes(recipientEmail, email, ccAddressesToSend)
      }
      return await sendViaPostman(http, recipientEmail, email)
    } catch (e) {
      if (useSes) {
        logger.error('Email send failed via SES', {
          event: 'postman-step-ses-email-failed',
          recipient: recipientEmail,
          errorName: e instanceof Error ? e.name : undefined,
          // The AWS error message is the actual reason (e.g. unverified
          // identity, malformed address/header). e.message is non-enumerable,
          // so it must be logged explicitly — `error: e` alone drops it.
          errorMessage: e instanceof Error ? e.message : String(e),
          httpStatus: (e as { $metadata?: { httpStatusCode?: number } })
            ?.$metadata?.httpStatusCode,
        })
      }
      throw {
        status: useSes ? getSesErrorStatus(e) : getPostmanErrorStatus(e),
        recipient: recipientEmail,
        error: e,
      } satisfies PostmanPromiseRejected
    }
  })

  const results = await Promise.allSettled(promises)
  const status: PostmanEmailSendStatus[] = []
  const recipient: string[] = []
  let params: Omit<PostmanEmailDataOut, 'status' | 'recipient'>
  const errors: PostmanPromiseRejected[] = []

  // Merge suppressed entries and send results back into input order so
  // dataOut.status[i] / dataOut.recipient[i] stay positionally aligned with
  // the original recipients list (retry logic relies on this).
  let resultIdx = 0
  recipients.forEach((recipientEmail) => {
    if (suppressedSet.has(recipientEmail)) {
      status.push('BLACKLISTED')
      recipient.push(recipientEmail)
      errors.push({
        status: 'BLACKLISTED',
        recipient: recipientEmail,
        error: {
          message: 'Email address is in suppression list',
        } as HttpError,
      })
      return
    }

    const result = results[resultIdx++]
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
   * Since we can only return one error per postman step, we have to select in terms of priority:
   * 1. RATE-LIMITED (so we can auto-retry)
   * 2. INVALID-ATTACHMENT (probably all recipients should fail)
   * 3. ATTACHMENT-SIZE-EXCEEDED (probably all recipients should fail)
   * 4. INTERMITTENT-ERROR (some recipients failed, auto-retry)
   * 5. ERROR (probably all recipients should fail)
   * 6. BLACKLISTED (blacklisted errors are returned even if there are other errors like invalid attachment)
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
