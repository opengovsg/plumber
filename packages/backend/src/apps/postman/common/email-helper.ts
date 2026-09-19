import { IHttpClient } from '@plumber/types'

import { SendEmailCommand } from '@aws-sdk/client-sesv2'
import FormData from 'form-data'
import { chunk, sortBy } from 'lodash'

import appConfig from '@/config/app'
import HttpError from '@/errors/http'
import logger from '@/helpers/logger'
import { incrementMetric } from '@/helpers/metrics'
import { sanitizeEmailHtml } from '@/helpers/sanitize-email-html'
import {
  formatFromAddress,
  getSesClient,
  isSesAttachmentsEnabledForRecipient,
  isSesEnabledForRecipient,
} from '@/helpers/ses-email-helper'
import EmailSuppressionEntry from '@/models/email-suppression-entry'

import { buildRawEmail, withRecipient } from './build-raw-mime'
import {
  PostmanEmailDataOut,
  PostmanEmailSendStatus,
} from './data-out-validator'
import { SendMode } from './parameters'
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
  sendMode: SendMode
}

/**
 * One SES API call. Individual mode has one To address per group. Combined
 * mode puts a chunk of To addresses in a group, with CCs on the first only.
 */
interface SendGroup {
  to: string[]
  cc?: string[]
}

// SES rejects a message with more than 50 destinations (To + CC + BCC).
const SES_MAX_RECIPIENTS_PER_MESSAGE = 50

/**
 * Splits combined-mode recipients into SES-sized groups. CCs count against the
 * first group's limit and are absent from later groups, so CC recipients get
 * exactly one copy.
 */
export function buildCombinedSendGroups(
  recipients: string[],
  cc: string[] | undefined,
): SendGroup[] {
  if (recipients.length === 0) {
    return []
  }
  const ccCount = cc?.length ?? 0
  const firstChunkSize = SES_MAX_RECIPIENTS_PER_MESSAGE - ccCount
  const [first, ...rest] = [
    recipients.slice(0, firstChunkSize),
    ...chunk(recipients.slice(firstChunkSize), SES_MAX_RECIPIENTS_PER_MESSAGE),
  ]
  return [
    { to: first, ...(ccCount > 0 && { cc }) },
    ...rest.map((to) => ({ to })),
  ]
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

// Total attachment cap for the SES path. SES accepts messages up to 40MB after
// base64 encoding (~1.37x), so we cap raw attachments at 20MB (~27MB encoded) to
// stay safely under that. Compared against raw (pre-base64) bytes. The Postman
// route enforces its own (smaller) limit server-side.
const SES_MAX_TOTAL_ATTACHMENT_SIZE_MB = 20
const SES_MAX_TOTAL_ATTACHMENT_SIZE =
  SES_MAX_TOTAL_ATTACHMENT_SIZE_MB * 1024 * 1024

// Thrown by the SES path when attachments exceed the cap above. Mapped to
// ATTACHMENT-SIZE-EXCEEDED by getSesErrorStatus (matched by name).
class AttachmentSizeExceededError extends Error {
  constructor() {
    super(`Total attachment size exceeds ${SES_MAX_TOTAL_ATTACHMENT_SIZE_MB}MB`)
    this.name = 'AttachmentSizeExceededError'
  }
}

/**
 * Sends one SES message to a group of To addresses. Returns the dataOut params
 * shared by every recipient in the group.
 */
async function sendViaSes(
  group: SendGroup,
  email: Email,
  // Raw MIME message (no `To:` header) built once by sendTransactionalEmails.
  // Always set when email.attachments?.length (that's the caller's contract);
  // the `To:` header is added cheaply via withRecipient rather than rebuilding
  // (and re-base64-encoding attachments for) every group.
  sharedRawMessage: Buffer | undefined,
): Promise<Omit<PostmanEmailDataOut, 'status' | 'recipient'>> {
  const client = getSesClient()
  // Address sent to SES: display name is RFC 5322-quoted when it contains
  // specials (e.g. a comma) so the header isn't malformed.
  const fromAddress = formatFromAddress(
    email.senderName,
    appConfig.ses.fromAddress,
  )
  // Human-readable form for dataOut — no quoting artifacts shown to the user.
  const displayFrom = `${email.senderName} <${appConfig.ses.fromAddress}>`

  // Logged for rollout visibility — counts/sizes only, never filenames/content.
  const attachmentCount = email.attachments?.length ?? 0
  const totalAttachmentBytes =
    email.attachments?.reduce(
      (sum, attachment) => sum + attachment.data.byteLength,
      0,
    ) ?? 0

  const destination = {
    ToAddresses: group.to,
    ...(group.cc?.length && { CcAddresses: group.cc }),
  }

  if (email.attachments?.length) {
    // Attachments require a raw MIME message — Content.Simple can't carry them.
    // From/Cc/Reply-To/Subject/body and the transport header all live in the
    // shared MIME; To: is added per group below, and the envelope is still
    // set via FromEmailAddress/Destination, matching the Simple path.
    const rawMessage = withRecipient(sharedRawMessage as Buffer, group.to)

    await client.send(
      new SendEmailCommand({
        FromEmailAddress: fromAddress,
        Destination: destination,
        Content: { Raw: { Data: rawMessage } },
        ...(appConfig.ses.configurationSet && {
          ConfigurationSetName: appConfig.ses.configurationSet,
        }),
      }),
    )
  } else {
    await client.send(
      new SendEmailCommand({
        FromEmailAddress: fromAddress,
        Destination: destination,
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
  }
  // Counted per recipient so the bounce/complaint rate denominator holds in
  // combined mode.
  incrementMetric('ses.email.sent', {}, group.to.length)

  // TODO: remove this log once the SES rollout is verified and stable.
  logger.info('Postman step email sent via SES', {
    event: 'postman-step-ses-email-sent',
    subject: email.subject,
    from: fromAddress,
    recipients: group.to,
    ccAddressesToSend: group.cc,
    sendMode: email.sendMode,
    attachmentCount,
    totalAttachmentBytes,
  })

  return {
    body: email.body,
    subject: email.subject,
    from: displayFrom,
    reply_to: email.replyTo,
    ...(email.ccList?.length && { cc: email.ccList }),
  }
}

/**
 * Resolve whether to route via SES for the given recipients. SES is used only
 * when `ses_enabled` is true for every recipient; if the email carries
 * attachments, `ses_attachments_enabled` must also be true for every recipient.
 * Otherwise the batch goes via Postman.
 */
export async function resolveSesRouting(
  recipients: string[],
  hasAttachments: boolean,
): Promise<boolean> {
  const sesEnabledPerRecipient = await Promise.all(
    recipients.map(isSesEnabledForRecipient),
  )
  if (!sesEnabledPerRecipient.every(Boolean)) {
    return false
  }
  if (!hasAttachments) {
    return true
  }
  const attachmentsEnabledPerRecipient = await Promise.all(
    recipients.map(isSesAttachmentsEnabledForRecipient),
  )
  return attachmentsEnabledPerRecipient.every(Boolean)
}

export async function sendTransactionalEmails(
  http: IHttpClient,
  recipients: string[],
  email: Email,
  // Whether to route via SES. Resolved once by the caller (see resolveSesRouting)
  // on the *configured* attachments rather than the post-filter list, so the
  // transport can't flip between runs when filtering strips attachments to zero.
  useSes: boolean,
): Promise<{
  dataOut: PostmanEmailDataOut
  errorStatus?: PostmanEmailSendStatus
  error?: HttpError
}> {
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

  const isCombinedSes = useSes && email.sendMode === 'combined'
  if (!useSes && email.sendMode === 'combined' && activeRecipients.length) {
    // Postman's API takes one recipient per call, so combined mode cannot be
    // honoured there. Deliver individually rather than fail the step.
    logger.warn('Combined send mode fell back to Postman', {
      event: 'postman-step-combined-mode-fallback',
      recipientCount: activeRecipients.length,
    })
    incrementMetric('postman.email.combined_fallback')
  }

  const sendGroups: SendGroup[] = isCombinedSes
    ? buildCombinedSendGroups(activeRecipients, ccAddressesToSend)
    : activeRecipients.map((to) => ({ to: [to], cc: ccAddressesToSend }))

  // Attachments, subject, body and reply-to are identical across groups — only
  // `To:` and (in combined mode) `Cc:` differ. Build the (potentially large)
  // base64-encoded MIME message once per Cc variant rather than once per group
  // inside sendViaSes; `To:` is added cheaply via withRecipient. Any
  // build/size-cap failure is captured and re-thrown inside each group's own
  // try/catch below, so per-recipient status/error mapping (e.g.
  // ATTACHMENT-SIZE-EXCEEDED) is unchanged.
  let rawMessageWithCc: Buffer | undefined
  let rawMessageWithoutCc: Buffer | undefined
  let attachmentBuildError: unknown
  if (useSes && email.attachments?.length && activeRecipients.length) {
    const totalAttachmentBytes = email.attachments.reduce(
      (sum, attachment) => sum + attachment.data.byteLength,
      0,
    )
    if (totalAttachmentBytes > SES_MAX_TOTAL_ATTACHMENT_SIZE) {
      attachmentBuildError = new AttachmentSizeExceededError()
    } else {
      const buildSharedRawEmail = (cc: string[] | undefined) =>
        buildRawEmail({
          from: formatFromAddress(email.senderName, appConfig.ses.fromAddress),
          cc,
          replyTo: email.replyTo,
          subject: email.subject,
          // Sanitise to match the server-side filtering the Postman path gets free.
          html: sanitizeEmailHtml(email.body),
          attachments: email.attachments,
          headers: { 'X-Plumber-Transport': 'ses' },
        })
      try {
        if (sendGroups.some((group) => group.cc?.length)) {
          rawMessageWithCc = await buildSharedRawEmail(ccAddressesToSend)
        }
        if (sendGroups.some((group) => !group.cc?.length)) {
          rawMessageWithoutCc = await buildSharedRawEmail(undefined)
        }
      } catch (e) {
        attachmentBuildError = e
      }
    }
  }

  // Logged once here (not per recipient below) since the same build error
  // applies identically to every active recipient. AttachmentSizeExceededError
  // is an expected/known outcome (user's attachments are just too big), so it's
  // not logged — only genuine build failures (e.g. buildRawEmail throwing) are.
  if (
    useSes &&
    attachmentBuildError &&
    !(attachmentBuildError instanceof AttachmentSizeExceededError)
  ) {
    logger.error('Email send failed via SES', {
      event: 'postman-step-ses-email-failed',
      recipients: activeRecipients,
      errorName:
        attachmentBuildError instanceof Error
          ? attachmentBuildError.name
          : undefined,
      errorMessage:
        attachmentBuildError instanceof Error
          ? attachmentBuildError.message
          : String(attachmentBuildError),
    })
  }

  const promises = sendGroups.map(async (group) => {
    try {
      if (useSes) {
        if (attachmentBuildError) {
          throw attachmentBuildError
        }
        return await sendViaSes(
          group,
          email,
          group.cc?.length ? rawMessageWithCc : rawMessageWithoutCc,
        )
      }
      // Postman groups always hold exactly one recipient.
      const sent = await sendViaPostman(http, group.to[0], email)
      return sent.params
    } catch (e) {
      // attachmentBuildError is already logged once above; only log genuine
      // send failures here to avoid logging it once per group.
      if (useSes && e !== attachmentBuildError) {
        logger.error('Email send failed via SES', {
          event: 'postman-step-ses-email-failed',
          recipients: group.to,
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
        error: e,
      } satisfies Omit<PostmanPromiseRejected, 'recipient'>
    }
  })

  const groupResults = await Promise.allSettled(promises)

  // Every recipient in a group shares its outcome. Expand to one result per
  // recipient, in activeRecipients order, so the merge below is mode-agnostic.
  const results: PromiseSettledResult<PostmanPromiseFulfilled>[] = []
  groupResults.forEach((result, groupIdx) => {
    for (const recipientEmail of sendGroups[groupIdx].to) {
      if (result.status === 'fulfilled') {
        results.push({
          status: 'fulfilled',
          value: {
            status: 'ACCEPTED',
            recipient: recipientEmail,
            params: result.value,
          },
        })
      } else {
        results.push({
          status: 'rejected',
          reason: {
            ...result.reason,
            recipient: recipientEmail,
          } satisfies PostmanPromiseRejected,
        })
      }
    }
  })

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
