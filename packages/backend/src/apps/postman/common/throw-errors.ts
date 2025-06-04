import { IGlobalVariable } from '@plumber/types'

import HttpError from '@/errors/http'
import PartialStepError from '@/errors/partial-error'
import RetriableError from '@/errors/retriable-error'
import StepError from '@/errors/step'

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

function getInvalidAttachmentSolution({
  invalidAttachments,
  formAdminLink,
}: {
  invalidAttachments: string[]
  formAdminLink: string | null
}) {
  return `The following attachment(s) are not supported by Postman and have been removed from the email:
  \n${invalidAttachments.map((attachment) => `**${attachment}**`).join('\n\n')}
  \nIf you require the attachment(s), log in to your [form](${formAdminLink}) to download them for this submission.
  `
}

export function throwPostmanStepError({
  $,
  status,
  error,
  isPartialSuccess,
  blacklistedRecipients,
  invalidAttachments,
  formAdminLink,
}: {
  $: IGlobalVariable
  status: PostmanEmailSendStatus
  error: HttpError
  isPartialSuccess: boolean
  blacklistedRecipients: string[]
  invalidAttachments: string[]
  formAdminLink: string | null
}) {
  const position = $.step.position
  const appName = $.app.name

  const hasInvalidAttachments = invalidAttachments.length > 0
  const invalidAttachmentsSolution = getInvalidAttachmentSolution({
    invalidAttachments,
    formAdminLink,
  })

  switch (status) {
    case 'BLACKLISTED': {
      let name = 'Blacklisted recipient email'
      const formLink = createRequestBlacklistFormLink({
        userEmail: $.user.email,
        executionId: $.execution.id,
        blacklistedRecipients,
      })
      let solution = `The following email addresses have been blacklisted by Postman:
         \n${blacklistedRecipients
           .map((recipient) => `**${recipient}**`)
           .join('\n\n')}
         \nIf you believe that they are valid and active, please [use this form](${formLink}) to request for removal from blacklist and try again.
        `

      if (hasInvalidAttachments) {
        name += ` and invalid attachment(s)`
        solution += `\n\n&nbsp;\n\n${invalidAttachmentsSolution}`
      }

      if (isPartialSuccess) {
        throw new PartialStepError({
          name,
          solution,
          position,
          appName,
          partialRetry: {
            buttonMessage: 'Resend to blacklisted recipients',
          },
        })
      }
      throw new StepError(name, solution, position, appName, error)
    }
    case 'RATE-LIMITED':
      // this will be auto-retried later on
      throw new RetriableError({
        error: error.details,
        delayInMs: 'default',
        delayType: 'queue',
      })
    case 'INVALID-ATTACHMENT':
      throw new StepError(
        'Password-protected attachment(s)',
        `Check that the attachment(s) are not password-protected.`,
        position,
        appName,
        error,
      )
    case 'ATTACHMENT-SIZE-EXCEEDED':
      throw new StepError(
        'Total attachment size exceeded',
        'Check that the attachments do not exceed 10MB in total.',
        position,
        appName,
        error,
      )
    case 'INTERMITTENT-ERROR':
      throw new RetriableError({
        error: error.details,
        delayInMs: 'default',
        delayType: 'step',
      })
    case 'ERROR':
    default:
      if (error.message === 'socket hang up') {
        throw new RetriableError({
          error: `Retrying ${error.message} from Postman`,
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
          formAdminLink,
        })

        throw new PartialStepError({
          name,
          solution,
          position,
          appName,
          partialRetry: { buttonMessage: '' }, // nothing to retry
        })
      }
      throw new StepError(
        'Something went wrong',
        'Please contact plumber@open.gov.sg for assistance.',
        position,
        appName,
        error,
      )
  }
}
