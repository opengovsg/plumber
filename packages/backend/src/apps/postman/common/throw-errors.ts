import { IGlobalVariable } from '@plumber/types'

import { BulkEmailEntryResult } from '@aws-sdk/client-sesv2'

import HttpError from '@/errors/http'
import PartialStepError from '@/errors/partial-error'
import RetriableError from '@/errors/retriable-error'
import StepError from '@/errors/step'
import logger from '@/helpers/logger'

import { PostmanEmailSendStatus } from './data-out-validator'
import { createRequestBlacklistFormLink } from './send-blacklist-email'

type PostmanApiErrorData = {
  code: string
  message: string
}

// These are HTTP error codes returned by Cloudflare, which likely indicate
// that Postman's origin server did not receive the request.
// Until this is fixed, we will retry these requests on behalf of the user
const POSTMAN_RETRIABLE_HTTP_CODES = [500, 502, 504, 520, 524]

export function getPostmanErrorStatus(
  error: HttpError,
): PostmanEmailSendStatus {
  const postmanErrorData: PostmanApiErrorData = error.response?.data ?? {}
  const { code: errorCode, message: errorMessage } = postmanErrorData
  // catch common postman error codes and provide solution
  switch (errorCode) {
    case 'invalid_template':
      if (errorMessage?.includes('attachments')) {
        return 'INVALID-ATTACHMENT'
      } else if (errorMessage?.includes('blacklisted')) {
        return 'BLACKLISTED'
      } else {
        // return original error if not caught
        return 'ERROR'
      }
    case 'rate_limit':
      return 'RATE-LIMITED'
    case 'attachment_limit':
      return 'ATTACHMENT-SIZE-EXCEEDED'
    default:
      if (POSTMAN_RETRIABLE_HTTP_CODES.includes(error.response?.status)) {
        return 'INTERMITTENT-ERROR'
      }
      // return original error if not caught
      return 'ERROR'
  }
}

/**
 * Maps SES SDK errors to our internal status codes.
 *
 * SES error reference: https://docs.aws.amazon.com/ses/latest/dg/troubleshoot-error-messages.html
 *
 * Key SES errors from @aws-sdk/client-sesv2:
 *  - MessageRejected (400): email rejected — identity not verified, blacklisted, etc.
 *  - SendingPausedException (400): account sending paused by AWS
 *  - AccountSuspendedException (400): account suspended
 *  - MailFromDomainNotVerifiedException (400): MAIL FROM domain not verified
 *  - TooManyRequestsException (429): daily quota or max send rate exceeded
 *  - BadRequestException (400): malformed request
 *  - NotFoundException (404): configuration set does not exist
 *  - InternalServiceErrorException (500): SES internal error
 */
export function getSesErrorStatus(error: unknown): PostmanEmailSendStatus {
  if (!(error instanceof Error)) {
    return 'ERROR'
  }

  // Pre-send size guard on the SES path: SES has no structured size error, so we
  // enforce the 20MB total ourselves and surface it like Postman's
  // `attachment_limit` → ATTACHMENT-SIZE-EXCEEDED.
  if (error.name === 'AttachmentSizeExceededError') {
    return 'ATTACHMENT-SIZE-EXCEEDED'
  }

  // SES SDK errors expose $metadata.httpStatusCode
  const httpStatus = (error as { $metadata?: { httpStatusCode?: number } })
    .$metadata?.httpStatusCode

  // Rate limiting — 429 or known throttling error names
  if (
    httpStatus === 429 ||
    error.name === 'TooManyRequestsException' ||
    error.name === 'ThrottlingException'
  ) {
    return 'RATE-LIMITED'
  }

  // Server errors — 500+ are transient, worth retrying
  if (httpStatus >= 500) {
    return 'INTERMITTENT-ERROR'
  }

  // MessageRejected — check message for specific sub-cases
  if (error.name === 'MessageRejected') {
    const msg = error.message?.toLowerCase() ?? ''
    if (msg.includes('blacklisted') || msg.includes('suppression list')) {
      return 'BLACKLISTED'
    }
    return 'ERROR'
  }

  // Account-level issues — not retriable, surface as ERROR
  if (
    error.name === 'SendingPausedException' ||
    error.name === 'AccountSuspendedException'
  ) {
    return 'ERROR'
  }

  return 'ERROR'
}

/**
 * Maps a per-entry result from SESv2 `SendBulkEmail` to our internal status
 * codes. Unlike `getSesErrorStatus` (which handles a thrown SDK error for the
 * *whole* call), this handles the per-recipient outcomes SES reports inline in a
 * 200 response — one `BulkEmailEntryResult` per `BulkEmailEntry`.
 *
 * Status reference:
 * https://docs.aws.amazon.com/ses/latest/APIReference-V2/API_BulkEmailEntryResult.html
 */
export function getSesBulkEntryStatus(
  result: BulkEmailEntryResult,
): PostmanEmailSendStatus {
  switch (result.Status) {
    // Throttling — the whole call succeeded but this entry was shed. Retriable.
    case 'ACCOUNT_THROTTLED':
    case 'ACCOUNT_DAILY_QUOTA_EXCEEDED':
      return 'RATE-LIMITED'

    // SES's own signal that the entry failed for a transient reason.
    case 'TRANSIENT_FAILURE':
      return 'INTERMITTENT-ERROR'

    // Mirrors the MessageRejected handling in getSesErrorStatus: only the
    // suppression-related sub-cases count as BLACKLISTED, everything else is a
    // genuine content/address rejection.
    case 'MESSAGE_REJECTED': {
      const msg = result.Error?.toLowerCase() ?? ''
      if (msg.includes('blacklisted') || msg.includes('suppression')) {
        return 'BLACKLISTED'
      }
      return 'ERROR'
    }

    // FAILED, INVALID_PARAMETER, ACCOUNT_SUSPENDED, ACCOUNT_SENDING_PAUSED,
    // CONFIGURATION_SET_*, TEMPLATE_NOT_FOUND, MAIL_FROM_DOMAIN_NOT_VERIFIED,
    // INVALID_SENDING_POOL_NAME — all non-retriable on our side.
    default:
      return 'ERROR'
  }
}

function getInvalidAttachmentSolution({
  invalidAttachments,
  showAttachmentsList = true,
}: {
  invalidAttachments: string[]
  showAttachmentsList?: boolean
}) {
  if (showAttachmentsList) {
    return `The following attachment(s) are not supported by Postman and have been removed from the email:
    \n${invalidAttachments
      .map((attachment) => `**${attachment}**`)
      .join('\n\n')}
    \nIf you require the attachment(s), log in to your form to download them for this submission.
    `
  }
  return `There were attachment(s) that could not be sent by Postman and have been removed from the email.
    \nIf you require the attachment(s), log in to your form to download them for this submission.
  `
}

export function throwPostmanStepError({
  $,
  status,
  error,
  isPartialSuccess,
  blacklistedRecipients,
  blacklistedCcs,
  invalidAttachments,
  isRetryWithoutAttachments,
}: {
  $: IGlobalVariable
  status: PostmanEmailSendStatus
  error: HttpError
  isPartialSuccess: boolean
  blacklistedRecipients: string[]
  blacklistedCcs: string[]
  invalidAttachments: string[]
  isRetryWithoutAttachments: boolean
}) {
  const hasInvalidAttachments = invalidAttachments.length > 0
  const invalidAttachmentsSolution = getInvalidAttachmentSolution({
    invalidAttachments,
    // should not show attachments list if we are retrying without attachments
    showAttachmentsList: !isRetryWithoutAttachments,
  })

  switch (status) {
    case 'BLACKLISTED': {
      // The same address can be blacklisted as both a To-recipient and a CC
      // (e.g. someone put it in both fields) — once it's already called out
      // in the recipients section, repeating it verbatim in a second CC
      // paragraph reads as a confusing duplicate, so the CC section only
      // covers addresses not already shown above.
      const ccOnlyBlacklisted = blacklistedCcs.filter(
        (cc) => !blacklistedRecipients.includes(cc),
      )
      const hasBlacklistedRecipients = blacklistedRecipients.length > 0
      const hasBlacklistedCcs = ccOnlyBlacklisted.length > 0

      let name = hasBlacklistedRecipients
        ? 'Blacklisted recipient email'
        : 'Blacklisted CC email'
      // The removal-request form covers both fields — recipients and CC are
      // just addresses to it, no distinction needed.
      const formLink = createRequestBlacklistFormLink({
        userEmail: $.user.email,
        executionId: $.execution.id,
        blacklistedRecipients: [
          ...new Set([...blacklistedRecipients, ...blacklistedCcs]),
        ],
      })

      // log individual blacklisted recipients and CCs
      blacklistedRecipients.forEach((recipient) => {
        logger.info('Blacklisted recipient for postman email step', {
          event: 'postman-step-blacklisted-recipient',
          blacklistedEmail: recipient,
          stepId: $.step.id,
          executionId: $.execution.id,
        })
      })
      blacklistedCcs.forEach((cc) => {
        logger.info('Blacklisted CC for postman email step', {
          event: 'postman-step-blacklisted-cc',
          blacklistedEmail: cc,
          stepId: $.step.id,
          executionId: $.execution.id,
        })
      })

      // Recipients and CC each get their own address list, but share a single
      // closing "use this form" sentence rather than repeating it per list.
      const addressSections: string[] = []
      if (hasBlacklistedRecipients) {
        addressSections.push(
          `The following email addresses have been blacklisted by Postman:
         \n${blacklistedRecipients
           .map((recipient) => `**${recipient}**`)
           .join('\n\n')}`,
        )
      }
      if (hasBlacklistedCcs) {
        name = hasBlacklistedRecipients
          ? 'Blacklisted recipient and CC email'
          : 'Blacklisted CC email'
        addressSections.push(
          `The following CC email addresses have been blacklisted by Postman:
         \n${ccOnlyBlacklisted.map((cc) => `**${cc}**`).join('\n\n')}`,
        )
      }

      const solutionSections: string[] = [
        `${addressSections.join('\n\n&nbsp;\n\n')}
         \nIf you believe that they are valid and active, please [use this form](${formLink}) to request for removal from blacklist and try again.
        `,
      ]

      if (hasInvalidAttachments) {
        name += ` and invalid attachment(s)`
        solutionSections.push(invalidAttachmentsSolution)
      }

      const solution = solutionSections.join('\n\n&nbsp;\n\n')

      // Offer the resend button whenever there's a blacklisted To-recipient
      // and/or a blacklisted CC — retry collects whichever of the two are
      // still blacklisted and resends them together as one send. Only
      // withheld when there's genuinely nothing to retry (mirrors the
      // invalid-attachments-only case above).
      let buttonMessage =
        hasBlacklistedRecipients || blacklistedCcs.length > 0
          ? 'Resend to blacklisted recipients'
          : ''
      if (buttonMessage && isRetryWithoutAttachments) {
        buttonMessage += ' without attachments'
      }

      if (isPartialSuccess) {
        throw new PartialStepError({
          name,
          solution,
          partialRetry: {
            buttonMessage,
          },
        })
      }
      throw new StepError(name, solution, error)
    }
    case 'RATE-LIMITED':
      // this will be auto-retried later on
      throw new RetriableError({
        error: error.details ?? error.message,
        delayInMs: 'default',
        delayType: 'queue',
      })
    case 'INVALID-ATTACHMENT':
      throw new StepError(
        'Password-protected attachment(s)',
        `Check that the attachment(s) are not password-protected.`,
        error,
      )
    case 'ATTACHMENT-SIZE-EXCEEDED':
      throw new StepError(
        'Total attachment size exceeded',
        'Check that the attachments do not exceed 20MB in total.',
        error,
      )
    case 'INTERMITTENT-ERROR':
      throw new RetriableError({
        error: error.details ?? error.message,
        delayInMs: 'default',
        delayType: 'step',
      })
    case 'ERROR':
    default:
      // socket hang up is a Cloudflare/Postman-specific issue; only retry
      // if the error came from the Postman path (not SES).
      if (error?.message === 'socket hang up') {
        throw new RetriableError({
          error: `Retrying ${error.message}`,
          delayInMs: 'default',
          delayType: 'step',
        })
      }

      // NOTE: we keep the INVALID-ATTACHMENT error as Postman may reject
      // attachments that are password-protected
      if (hasInvalidAttachments) {
        const name = 'Invalid attachment(s)'
        const solution = getInvalidAttachmentSolution({
          invalidAttachments,
          showAttachmentsList: true,
        })

        // throw StepError for test runs so that user cannot publish the pipe
        // until the error is fixed
        if ($.execution.testRun) {
          throw new StepError(name, solution, error)
        }

        throw new PartialStepError({
          name,
          solution: invalidAttachmentsSolution,
          partialRetry: { buttonMessage: '' }, // nothing to retry
        })
      }
      throw new StepError(
        'Something went wrong',
        'Please contact plumber@open.gov.sg for assistance.',
        error,
      )
  }
}
