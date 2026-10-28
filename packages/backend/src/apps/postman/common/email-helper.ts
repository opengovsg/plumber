import { SendEmailCommand } from '@aws-sdk/client-sesv2'
import { IHttpClient } from '@plumber/types'
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

import { buildRawEmail, withRecipients } from './build-raw-mime'
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

/** What the email says. Identical for every send in a step. */
interface EmailContent {
  subject: string
  body: string
  senderName: string
  attachments?: { fileName: string; data: Uint8Array }[]
  replyTo?: string
}

/**
 * The step's email as configured.
 *
 * IMPORTANT: ccList and sendMode are only read while planning the send groups.
 * Send functions take EmailContent, so a send's CCs can only come from its
 * SendGroup.
 */
interface Email extends EmailContent {
  ccList?: string[]
  sendMode: SendMode
}

/** Recipients left after the pre-send suppression check. */
interface ResolvedRecipients {
  to: string[]
  cc: string[]
  blacklistedCcs: string[]
  suppressed: Set<string>
}

/** One API call, holding every address that call is sent to. */
interface SendGroup {
  to: string[]
  cc?: string[]
}

type SentParams = Omit<PostmanEmailDataOut, 'status' | 'recipient'>

interface PostmanPromiseFulfilled {
  status: 'ACCEPTED'
  recipient: string
  params: SentParams
}

interface PostmanPromiseRejected {
  status: PostmanEmailSendStatus
  recipient: string
  error: HttpError
}

type GroupFailure = Omit<PostmanPromiseRejected, 'recipient'>

interface SendOutcome {
  dataOut: PostmanEmailDataOut
  blacklistedCcs: string[]
  errorStatus?: PostmanEmailSendStatus
  error?: HttpError
}

// SES rejects a message with more than 50 destinations (To + CC + BCC).
const SES_MAX_RECIPIENTS_PER_MESSAGE = 50

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

/**
 * Drops suppressed To and CC addresses, since re-sending to them would
 * re-bounce and inflate the bounce rate. SES path only, because Postman checks
 * its own blacklist.
 */
async function resolveRecipients(
  recipients: string[],
  ccList: string[] | undefined,
  useSes: boolean,
): Promise<ResolvedRecipients> {
  let suppressed = new Set<string>()
  if (useSes) {
    suppressed = new Set(
      await EmailSuppressionEntry.getSuppressedEmails([
        ...recipients,
        ...(ccList ?? []),
      ]),
    )

    if (suppressed.size > 0) {
      logger.info('Suppressed emails filtered out before sending', {
        event: 'pre-send-suppression-check',
        suppressedCount: suppressed.size,
        totalRecipients: recipients.length,
      })
    }
  }

  return {
    to: recipients.filter((r) => !suppressed.has(r)),
    cc: (ccList ?? []).filter((cc) => !suppressed.has(cc)),
    blacklistedCcs: (ccList ?? []).filter((cc) => suppressed.has(cc)),
    suppressed,
  }
}

/**
 * Combined mode batches To addresses. Every group carries every CC so CCs
 * receive every email.
 */
function planSendGroups(
  resolved: ResolvedRecipients,
  sendMode: SendMode,
  useSes: boolean,
): SendGroup[] {
  const isCombined = sendMode === 'combined'
  if (isCombined && !useSes && resolved.to.length) {
    // Postman's API takes one recipient per call, so combined mode cannot be
    // honoured there. Deliver individually rather than fail the step.
    logger.warn('Combined send mode fell back to Postman', {
      event: 'postman-step-combined-mode-fallback',
      recipientCount: resolved.to.length,
    })
    incrementMetric('postman.email.combined_fallback')
  }

  const batchSize =
    isCombined && useSes
      ? SES_MAX_RECIPIENTS_PER_MESSAGE - resolved.cc.length
      : 1
  // The CC field's validation caps CCs at 49. Without this, chunk would
  // silently return no groups and every To recipient would go unsent.
  if (batchSize < 1) {
    throw new Error(
      `Combined send needs fewer than ${SES_MAX_RECIPIENTS_PER_MESSAGE} CC recipients`,
    )
  }

  return chunk(resolved.to, batchSize).map((to) => ({
    to,
    ...(resolved.cc.length > 0 && { cc: resolved.cc }),
  }))
}

type SharedRawMessage =
  | { status: 'not-needed' }
  | { status: 'built'; message: Buffer }
  | { status: 'failed'; error: unknown }

/**
 * Builds the raw MIME message once for every group, so attachments are
 * base64-encoded once per step rather than once per send. The To and Cc headers
 * come from each group, so withRecipients adds them per send.
 */
async function buildSharedRawMessage(
  content: EmailContent,
): Promise<SharedRawMessage> {
  if (!content.attachments?.length) {
    return { status: 'not-needed' }
  }
  const totalAttachmentBytes = content.attachments.reduce(
    (sum, attachment) => sum + attachment.data.byteLength,
    0,
  )
  if (totalAttachmentBytes > SES_MAX_TOTAL_ATTACHMENT_SIZE) {
    return { status: 'failed', error: new AttachmentSizeExceededError() }
  }
  try {
    const message = await buildRawEmail({
      from: formatFromAddress(content.senderName, appConfig.ses.fromAddress),
      replyTo: content.replyTo,
      subject: content.subject,
      // Sanitise to match the server-side filtering the Postman path gets free.
      html: sanitizeEmailHtml(content.body),
      attachments: content.attachments,
      headers: { 'X-Plumber-Transport': 'ses' },
    })
    return { status: 'built', message }
  } catch (e) {
    return { status: 'failed', error: e }
  }
}

async function sendViaPostman(
  http: IHttpClient,
  group: SendGroup,
  content: EmailContent,
): Promise<SentParams> {
  // Postman groups always hold exactly one recipient.
  const recipientEmail = group.to[0]
  const requestData = new FormData()
  requestData.append('subject', content.subject)
  requestData.append('body', content.body)
  requestData.append('recipient', recipientEmail)
  requestData.append(
    'from',
    `${content.senderName} <${appConfig.postman.fromAddress}>`,
  )
  requestData.append('disable_tracking', 'true')
  if (group.cc?.length > 0) {
    requestData.append('cc', JSON.stringify(group.cc))
  }

  if (content.replyTo) {
    requestData.append('reply_to', content.replyTo)
  }

  for (const attachment of content.attachments ?? []) {
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
  const { body, subject, from, reply_to } = response.data.params
  return { body, subject, from, reply_to }
}

/**
 * Sends one SES message to a group. Returns the dataOut params shared by every
 * recipient in the group.
 */
async function sendViaSes(
  group: SendGroup,
  content: EmailContent,
  // Set exactly when the email has attachments, which Content.Simple cannot
  // carry.
  sharedRawMessage: Buffer | undefined,
  sendMode: SendMode,
): Promise<SentParams> {
  const client = getSesClient()
  // Address sent to SES: display name is RFC 5322-quoted when it contains
  // specials (e.g. a comma) so the header isn't malformed.
  const fromAddress = formatFromAddress(
    content.senderName,
    appConfig.ses.fromAddress,
  )
  // Human-readable form for dataOut — no quoting artifacts shown to the user.
  const displayFrom = `${content.senderName} <${appConfig.ses.fromAddress}>`

  // Logged for rollout visibility — counts/sizes only, never filenames/content.
  const attachmentCount = content.attachments?.length ?? 0
  const totalAttachmentBytes =
    content.attachments?.reduce(
      (sum, attachment) => sum + attachment.data.byteLength,
      0,
    ) ?? 0

  const destination = {
    ToAddresses: group.to,
    ...(group.cc?.length && { CcAddresses: group.cc }),
  }

  if (sharedRawMessage) {
    // The envelope is still set via FromEmailAddress/Destination, matching the
    // Simple path.
    const rawMessage = withRecipients(sharedRawMessage, group.to, group.cc)

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
            Subject: { Data: content.subject, Charset: 'UTF-8' },
            Body: {
              // SES sends the body verbatim; sanitise to match the server-side
              // filtering the Postman path gets for free.
              Html: { Data: sanitizeEmailHtml(content.body), Charset: 'UTF-8' },
            },
            // Marks the message as sent via the SES direct path (absent =>
            // routed through Postman). Recipient-invisible; for triage only.
            Headers: [{ Name: 'X-Plumber-Transport', Value: 'ses' }],
          },
        },
        ...(content.replyTo && { ReplyToAddresses: [content.replyTo] }),
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
    subject: content.subject,
    from: fromAddress,
    recipients: group.to,
    ccAddressesToSend: group.cc,
    sendMode,
    attachmentCount,
    totalAttachmentBytes,
  })

  return {
    body: content.body,
    subject: content.subject,
    from: displayFrom,
    reply_to: content.replyTo,
  }
}

/**
 * Returns one settled result per group, in group order. A failed group rejects
 * with a GroupFailure that every recipient in it shares.
 */
async function sendGroups(
  http: IHttpClient,
  groups: SendGroup[],
  content: EmailContent,
  useSes: boolean,
  sendMode: SendMode,
): Promise<PromiseSettledResult<SentParams>[]> {
  const rawMessage: SharedRawMessage =
    useSes && groups.length
      ? await buildSharedRawMessage(content)
      : { status: 'not-needed' }

  // Logged once here rather than per group, since every group fails with the
  // same error. AttachmentSizeExceededError is an expected outcome (the user's
  // attachments are too big), so only genuine build failures are logged.
  if (
    rawMessage.status === 'failed' &&
    !(rawMessage.error instanceof AttachmentSizeExceededError)
  ) {
    const { error } = rawMessage
    logger.error('Email send failed via SES', {
      event: 'postman-step-ses-email-failed',
      recipients: groups.flatMap((group) => group.to),
      errorName: error instanceof Error ? error.name : undefined,
      errorMessage: error instanceof Error ? error.message : String(error),
    })
  }

  return Promise.allSettled(
    groups.map(async (group) => {
      try {
        if (!useSes) {
          return await sendViaPostman(http, group, content)
        }
        if (rawMessage.status === 'failed') {
          throw rawMessage.error
        }
        return await sendViaSes(
          group,
          content,
          rawMessage.status === 'built' ? rawMessage.message : undefined,
          sendMode,
        )
      } catch (e) {
        const isBuildError =
          rawMessage.status === 'failed' && e === rawMessage.error
        if (useSes && !isBuildError) {
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
        } satisfies GroupFailure
      }
    }),
  )
}

/**
 * Maps group outcomes back to one status per configured recipient, in input
 * order. Retries rely on dataOut.status[i] matching dataOut.recipient[i].
 */
function collectResults(
  recipients: string[],
  ccList: string[] | undefined,
  resolved: ResolvedRecipients,
  groups: SendGroup[],
  groupResults: PromiseSettledResult<SentParams>[],
): SendOutcome {
  // IMPORTANT: groups hold the unsuppressed recipients in input order. The
  // index walk below depends on it.
  const sendResults = groupResults.flatMap((result, groupIdx) =>
    groups[groupIdx].to.map(
      (recipientEmail): PromiseSettledResult<PostmanPromiseFulfilled> =>
        result.status === 'fulfilled'
          ? {
              status: 'fulfilled',
              value: {
                status: 'ACCEPTED',
                recipient: recipientEmail,
                params: result.value,
              },
            }
          : {
              status: 'rejected',
              reason: {
                ...(result.reason as GroupFailure),
                recipient: recipientEmail,
              } satisfies PostmanPromiseRejected,
            },
    ),
  )

  const status: PostmanEmailSendStatus[] = []
  const recipient: string[] = []
  let params: SentParams | undefined
  const errors: PostmanPromiseRejected[] = []

  let resultIdx = 0
  recipients.forEach((recipientEmail) => {
    if (resolved.suppressed.has(recipientEmail)) {
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

    const result = sendResults[resultIdx++]
    if (result.status === 'fulfilled') {
      status.push(result.value.status)
      recipient.push(result.value.recipient)
      // Every successful send shares the same params.
      params ??= result.value.params
    } else {
      status.push(result.reason.status)
      recipient.push(result.reason.recipient)
      errors.push(result.reason)
    }
  })

  // Suppressed CCs surface as BLACKLISTED like suppressed To recipients, so the
  // step reports them even when every To send succeeded.
  for (const cc of resolved.blacklistedCcs) {
    errors.push({
      status: 'BLACKLISTED',
      recipient: cc,
      error: {
        message: 'CC email address is in suppression list',
      } as HttpError,
    })
  }

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
    // dataOut reports the configured CCs, including any that were suppressed.
    ...(params && { ...params, ...(ccList?.length && { cc: ccList }) }),
  } satisfies PostmanEmailDataOut
  return {
    dataOut,
    blacklistedCcs: resolved.blacklistedCcs,
    error: sortedErrors.length ? sortedErrors[0].error : undefined,
    errorStatus: sortedErrors.length ? sortedErrors[0].status : undefined,
  }
}

export async function sendTransactionalEmails(
  http: IHttpClient,
  recipients: string[],
  email: Email,
  // Whether to route via SES. Resolved once by the caller (see resolveSesRouting)
  // on the *configured* attachments rather than the post-filter list, so the
  // transport can't flip between runs when filtering strips attachments to zero.
  useSes: boolean,
): Promise<SendOutcome> {
  const { ccList, sendMode, ...content } = email
  const resolved = await resolveRecipients(recipients, ccList, useSes)
  const groups = planSendGroups(resolved, sendMode, useSes)
  const groupResults = await sendGroups(http, groups, content, useSes, sendMode)
  return collectResults(recipients, ccList, resolved, groups, groupResults)
}
