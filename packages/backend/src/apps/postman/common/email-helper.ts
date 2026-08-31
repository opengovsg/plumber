import { IHttpClient } from '@plumber/types'

import { BulkEmailContent, SendBulkEmailCommand } from '@aws-sdk/client-sesv2'
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

import {
  PostmanEmailDataOut,
  PostmanEmailSendStatus,
} from './data-out-validator'
import {
  getPostmanErrorStatus,
  getSesBulkEntryStatus,
  getSesErrorStatus,
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

// SESv2 SendBulkEmail accepts at most 50 BulkEmailEntries per call.
const SES_BULK_MAX_ENTRIES = 50

/**
 * Send via SESv2 `SendBulkEmail`, in chunks of up to `SES_BULK_MAX_ENTRIES`
 * recipients. Each chunk is sent as a single `BulkEmailEntry` with every
 * recipient in that chunk in `Destination.ToAddresses` — one shared email per
 * chunk (everyone in a chunk sees everyone else's address).
 *
 * Only one chunk ever carries CC — enough to deliver it once, without
 * duplicating it across chunks or risking SES's real per-message limit (50
 * combined To+Cc+Bcc addresses; a full `SES_BULK_MAX_ENTRIES`-recipient chunk
 * plus any CC would already be over). If there are To recipients, the first
 * chunk carries CC, sized to leave it room
 * (`SES_BULK_MAX_ENTRIES - ccAddressesToSend.length`); every subsequent chunk
 * gets the full `SES_BULK_MAX_ENTRIES` recipients with no CC. If there are no
 * To recipients at all (a CC-only retry — every To recipient already
 * succeeded, only CC needs resending), CC still goes out on its own: one
 * chunk with no `ToAddresses`.
 *
 * SES returns exactly one `BulkEmailEntryResult` per entry, so that single
 * outcome is broadcast to every recipient in the chunk. The function still
 * returns one result *per recipient*, in `activeRecipients` order, so the
 * caller's dataOut shape and per-recipient partial retry are unaffected by
 * there being only one physical email underneath. Suppressed/blacklisted
 * recipients never reach this function (filtered out by the caller before
 * chunking), so blacklist granularity stays fully per-recipient regardless of
 * this broadcast. CC's own outcome is tracked separately via `ccOutcome`,
 * scoped to whichever single chunk actually carries it — it isn't "a
 * recipient" and has no independent send of its own to fail.
 */
async function sendViaSesBulk(
  activeRecipients: string[],
  email: Email,
  // CC addresses to actually send to. Suppressed CCs are dropped from the SES
  // call so we don't re-send to known-bad addresses (which would re-bounce and
  // inflate the bounce rate). The full email.ccList is still reported in
  // dataOut by the caller — only the API call is filtered.
  ccAddressesToSend: string[] | undefined,
): Promise<{
  results: PromiseSettledResult<PostmanPromiseFulfilled>[]
  // Whether ccAddressesToSend (if any) was delivered in at least one group,
  // and — if not — every failure status seen across the groups that carried
  // it (there's usually only one, but multiple groups can fail differently).
  // Undefined when there was no CC to send in the first place.
  ccOutcome:
    | { delivered: boolean; failureStatuses: PostmanEmailSendStatus[] }
    | undefined
}> {
  // Address sent to SES: display name is RFC 5322-quoted when it contains
  // specials (e.g. a comma) so the header isn't malformed.
  const fromAddress = formatFromAddress(
    email.senderName,
    appConfig.ses.fromAddress,
  )
  // Human-readable form for dataOut — no quoting artifacts shown to the user.
  const displayFrom = `${email.senderName} <${appConfig.ses.fromAddress}>`

  // Identical for every recipient — the only thing that varies is the envelope.
  const params: Omit<PostmanEmailDataOut, 'status' | 'recipient'> = {
    body: email.body,
    subject: email.subject,
    from: displayFrom,
    reply_to: email.replyTo,
    ...(email.ccList?.length && { cc: email.ccList }),
  }

  // Logged for rollout visibility — counts/sizes only, never filenames/content.
  const attachmentCount = email.attachments?.length ?? 0
  const totalAttachmentBytes =
    email.attachments?.reduce(
      (sum, attachment) => sum + attachment.data.byteLength,
      0,
    ) ?? 0

  // Pre-send size guard: SES has no structured size error, so we enforce the cap
  // ourselves before spending an API call. Raw bytes here — ~27MB once base64
  // encoded, still comfortably under SES's 40MB message limit.
  if (totalAttachmentBytes > SES_MAX_TOTAL_ATTACHMENT_SIZE) {
    // Not logged: the user's attachments are simply too big, which is an
    // expected outcome surfaced to them as ATTACHMENT-SIZE-EXCEEDED.
    const error = new AttachmentSizeExceededError()
    const status = getSesErrorStatus(error)
    return {
      results: activeRecipients.map((recipientEmail) => ({
        status: 'rejected',
        reason: {
          status,
          recipient: recipientEmail,
          error: error as unknown as HttpError,
        } satisfies PostmanPromiseRejected,
      })),
      ccOutcome: ccAddressesToSend?.length
        ? { delivered: false, failureStatuses: [status] }
        : undefined,
    }
  }

  // SES renders `TemplateContent` through Handlebars, so user content must never
  // be part of the template itself — a literal `{{` in a subject or body would
  // otherwise break rendering. Instead the template is two placeholders and the
  // real content travels as `TemplateData`, where it is only ever substituted
  // in, never re-parsed. Plain double-stache, not triple-stache: SES's inline
  // template compiler (as opposed to stored CreateEmailTemplate templates)
  // rejects `{{{ }}}` with BadRequestException "Template contains unsupported
  // operations". This is also not a functional downgrade — per AWS's docs, SES
  // never HTML-escapes template output regardless of stache style, so the
  // sanitised HTML body still arrives intact.
  const defaultContent: BulkEmailContent = {
    Template: {
      TemplateContent: {
        Subject: '{{subject}}',
        Html: '{{body}}',
      },
      TemplateData: JSON.stringify({
        subject: email.subject,
        // Sanitise to match the server-side filtering the Postman path gets free.
        body: sanitizeEmailHtml(email.body),
      }),
      // Marks the message as sent via the SES direct path (absent => routed
      // through Postman). Recipient-invisible; for triage only.
      Headers: [{ Name: 'X-Plumber-Transport', Value: 'ses' }],
      ...(email.attachments?.length && {
        // SES builds the MIME message for us — all recipients in the call get
        // the same attachments, which is exactly our semantics.
        Attachments: email.attachments.map((attachment) => ({
          FileName: attachment.fileName,
          RawContent: attachment.data,
          // Force a real download. Left to the client, an attachment SES
          // detects as message/* (e.g. .eml) would render inline as a nested
          // email instead of a downloadable file. None of our attachments are
          // ever inline/cid-embedded.
          ContentDisposition: 'ATTACHMENT' as const,
        })),
      }),
    },
  }

  // Only one group ever carries CC, sized to leave it room within SES's
  // 50-combined-recipients-per-message limit — every other group gets the
  // full SES_BULK_MAX_ENTRIES recipients with no CC (it already got its one
  // copy elsewhere). When To+CC together fit in one message already, this
  // collapses to a single group with everyone in it. If there are no To
  // recipients at all (a CC-only retry), CC still gets its own group with no
  // recipients rather than being silently dropped.
  const ccCount = ccAddressesToSend?.length ?? 0
  const recipientGroups: { recipients: string[]; cc: string[] | undefined }[] =
    ccCount === 0
      ? chunk(activeRecipients, SES_BULK_MAX_ENTRIES).map((recipients) => ({
          recipients,
          cc: undefined as string[] | undefined,
        }))
      : activeRecipients.length === 0
      ? [{ recipients: [], cc: ccAddressesToSend }]
      : (() => {
          const firstChunkSize = Math.min(
            activeRecipients.length,
            SES_BULK_MAX_ENTRIES - ccCount,
          )
          const remainingRecipients = activeRecipients.slice(firstChunkSize)
          return [
            {
              recipients: activeRecipients.slice(0, firstChunkSize),
              cc: ccAddressesToSend,
            },
            ...chunk(remainingRecipients, SES_BULK_MAX_ENTRIES).map(
              (recipients) => ({
                recipients,
                cc: undefined as string[] | undefined,
              }),
            ),
          ]
        })()

  const client = getSesClient()
  // CC rides along on every group (recipient-bearing or CC-only): delivered
  // if any group succeeds. If none do, every failing group's status is kept
  // (not just the last one to resolve — groups run concurrently, so there's
  // no meaningful "latest" failure) and the caller picks the highest-priority
  // one via the same priority sort it already applies to recipient errors.
  let ccDelivered = false
  const ccFailureStatuses: PostmanEmailSendStatus[] = []

  const chunkResults = await Promise.all(
    recipientGroups.map(
      async ({
        recipients: recipientChunk,
        cc: chunkCc,
      }): Promise<PromiseSettledResult<PostmanPromiseFulfilled>[]> => {
        try {
          // One shared BulkEmailEntry per group — every recipient in it goes
          // into the same Destination.ToAddresses, so they're sent a single
          // email together (not N personalised copies). SES caps a single
          // message at 50 combined To/Cc/Bcc addresses, which is why only one
          // group (see above) ever carries CC.
          const response = await client.send(
            new SendBulkEmailCommand({
              FromEmailAddress: fromAddress,
              ...(email.replyTo && { ReplyToAddresses: [email.replyTo] }),
              DefaultContent: defaultContent,
              BulkEmailEntries: [
                {
                  Destination: {
                    ...(recipientChunk.length && {
                      ToAddresses: recipientChunk,
                    }),
                    ...(chunkCc?.length && { CcAddresses: chunkCc }),
                  },
                },
              ],
              ...(appConfig.ses.configurationSet && {
                ConfigurationSetName: appConfig.ses.configurationSet,
              }),
            }),
          )

          // TODO: remove this log once the SES rollout is verified and stable.
          logger.info('Postman step email sent via SES', {
            event: 'postman-step-ses-email-sent',
            subject: email.subject,
            from: fromAddress,
            recipients: recipientChunk,
            ccAddressesToSend: chunkCc,
            attachmentCount,
            totalAttachmentBytes,
          })

          // SES returns exactly one BulkEmailEntryResult here (one entry was
          // sent). A 200 does not mean it was accepted. That single outcome is
          // broadcast to every recipient in the group — the caller still gets
          // one result per recipient, in `activeRecipients` order, so dataOut's
          // shape and per-recipient partial retry are unaffected by there
          // being only one physical email underneath.
          const entryResult = response.BulkEmailEntryResults?.[0]

          if (entryResult?.Status === 'SUCCESS') {
            if (chunkCc?.length) {
              ccDelivered = true
            }
            if (recipientChunk.length > 0) {
              incrementMetric('ses.email.sent', {}, recipientChunk.length)
            }
            return recipientChunk.map((recipientEmail) => ({
              status: 'fulfilled',
              value: {
                status: 'ACCEPTED',
                recipient: recipientEmail,
                params,
              },
            }))
          }

          // A missing result is treated like a failure rather than silently
          // reported as sent.
          const entryStatus = entryResult?.Status ?? 'MISSING_ENTRY_RESULT'
          const error = new Error(
            entryResult?.Error ?? `SES rejected the entry (${entryStatus})`,
          ) as unknown as HttpError

          logger.error('Email send failed via SES', {
            event: 'postman-step-ses-email-failed',
            recipients: recipientChunk,
            bulkEntryStatus: entryStatus,
            errorMessage: entryResult?.Error,
          })

          const status = entryResult
            ? getSesBulkEntryStatus(entryResult)
            : 'ERROR'
          if (chunkCc?.length) {
            ccFailureStatuses.push(status)
          }
          return recipientChunk.map((recipientEmail) => ({
            status: 'rejected',
            reason: {
              status,
              recipient: recipientEmail,
              error,
            } satisfies PostmanPromiseRejected,
          }))
        } catch (e) {
          // The whole call failed (e.g. TooManyRequestsException,
          // BadRequestException from an oversized TemplateData), so nothing in
          // this group was sent — every recipient in it gets the mapped status.
          logger.error('Email send failed via SES', {
            event: 'postman-step-ses-email-failed',
            recipients: recipientChunk,
            errorName: e instanceof Error ? e.name : undefined,
            // The AWS error message is the actual reason (e.g. unverified
            // identity, malformed address/header). e.message is non-enumerable,
            // so it must be logged explicitly — `error: e` alone drops it.
            errorMessage: e instanceof Error ? e.message : String(e),
            httpStatus: (e as { $metadata?: { httpStatusCode?: number } })
              ?.$metadata?.httpStatusCode,
          })

          const status = getSesErrorStatus(e)
          if (chunkCc?.length) {
            ccFailureStatuses.push(status)
          }
          return recipientChunk.map((recipientEmail) => ({
            status: 'rejected' as const,
            reason: {
              status,
              recipient: recipientEmail,
              error: e,
            } satisfies PostmanPromiseRejected,
          }))
        }
      },
    ),
  )

  return {
    results: chunkResults.flat(),
    ccOutcome:
      ccCount > 0
        ? { delivered: ccDelivered, failureStatuses: ccFailureStatuses }
        : undefined,
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
  // (which would re-bounce and inflate the bounce rate). The full ccList is
  // still reported in dataOut, alongside its per-address ccStatus below.
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
  // ccList, with `ccStatus` (computed below) marking suppressed addresses.
  const ccAddressesToSend = email.ccList?.filter((cc) => !suppressedSet.has(cc))

  // SES sends the whole batch in ⌈N/50⌉ bulk calls and reports a per-recipient
  // outcome; Postman still needs one API call per recipient. CC has no status
  // tracking on the Postman path (it never checks suppression), so ccOutcome
  // is only ever populated on the SES path.
  const {
    results,
    ccOutcome,
  }: {
    results: PromiseSettledResult<PostmanPromiseFulfilled>[]
    ccOutcome:
      | { delivered: boolean; failureStatuses: PostmanEmailSendStatus[] }
      | undefined
  } = useSes
    ? await sendViaSesBulk(activeRecipients, email, ccAddressesToSend)
    : {
        results: await Promise.allSettled(
          activeRecipients.map(async (recipientEmail) => {
            try {
              return await sendViaPostman(http, recipientEmail, email)
            } catch (e) {
              throw {
                status: getPostmanErrorStatus(e),
                recipient: recipientEmail,
                error: e,
              } satisfies PostmanPromiseRejected
            }
          }),
        ),
        ccOutcome: undefined,
      }

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

  // CC has no per-recipient send of its own to fail — it rides along on the
  // To send(s) — so a CC problem can only be surfaced by pushing a synthetic
  // error here. Without this, `errorStatus` below would stay undefined (and
  // no PartialStepError would ever mention the CC) whenever every To
  // recipient succeeded. Blacklisted CCs never reach sendViaSesBulk at all
  // (filtered out pre-send), so their status is known immediately; any other
  // CC send failure (rate-limited, transient, etc.) is only known via
  // ccOutcome. The two are mutually exclusive — a blacklisted CC is excluded
  // from ccAddressesToSend, so ccOutcome only reflects the non-blacklisted
  // subset — but both are pushed independently and left to the priority sort
  // below, so e.g. a rate-limited CC still wins over an unrelated blacklist.
  const blacklistedCcs = (email.ccList ?? []).filter((cc) =>
    suppressedSet.has(cc),
  )
  if (blacklistedCcs.length > 0) {
    errors.push({
      status: 'BLACKLISTED',
      recipient: blacklistedCcs.join(', '),
      error: {
        message: 'CC email address is in suppression list',
      } as HttpError,
    })
  }
  if (ccOutcome && !ccOutcome.delivered) {
    // One entry per distinct failure status seen (usually just one, but
    // groups run concurrently and can fail differently) — the priority sort
    // below picks the right one, rather than us guessing which "wins".
    for (const status of new Set(ccOutcome.failureStatuses)) {
      errors.push({
        status,
        recipient: (ccAddressesToSend ?? []).join(', '),
        error: {
          message: 'Failed to deliver to CC recipient(s)',
        } as HttpError,
      })
    }
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

  // CC status is only meaningful on the SES path — the Postman path never
  // checks suppression, so CC there stays untracked (folded into `params.cc`
  // only, as before). ccOutcome is the direct, authoritative signal for
  // whether CC was delivered (it accounts for every group CC rode along on,
  // including a CC-only send with no To recipients at all) — no need to infer
  // it from the To recipients' own statuses.
  const ccStatus: PostmanEmailSendStatus[] | undefined =
    useSes && email.ccList?.length
      ? email.ccList.map((cc): PostmanEmailSendStatus => {
          if (suppressedSet.has(cc)) {
            return 'BLACKLISTED'
          }
          if (ccOutcome?.delivered) {
            return 'ACCEPTED'
          }
          // Nothing was delivered at all — mirror the same top-priority
          // error the step itself surfaces (ccOutcome's own failure
          // status(es), if any, were already folded into `errors` above, so
          // sortedErrors already reflects the right one here).
          return sortedErrors.length ? sortedErrors[0].status : 'ERROR'
        })
      : undefined

  const dataOut = {
    status,
    recipient,
    ...params,
    ...(ccStatus && { ccStatus }),
  } satisfies PostmanEmailDataOut
  return {
    dataOut,
    error: sortedErrors.length ? sortedErrors[0].error : undefined,
    errorStatus: sortedErrors.length ? sortedErrors[0].status : undefined,
  }
}
