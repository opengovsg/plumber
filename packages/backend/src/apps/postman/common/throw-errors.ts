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
const POSTMAN_RETRIABLE_HTTP_CODES = [502, 504, 520]

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
    default:
      if (POSTMAN_RETRIABLE_HTTP_CODES.includes(error.response?.status)) {
        return 'INTERMITTENT-ERROR'
      }
      // return original error if not caught
      return 'ERROR'
  }
}

export function throwPostmanStepError({
  $,
  status,
  error,
  isPartialSuccess,
  blacklistedRecipients,
}: {
  $: IGlobalVariable
  status: PostmanEmailSendStatus
  error: HttpError
  isPartialSuccess: boolean
  blacklistedRecipients: string[]
}) {
  const position = $.step.position
  const appName = $.app.name

  switch (status) {
    case 'BLACKLISTED': {
      const name = 'Blacklisted recipient email'
      const formLink = createRequestBlacklistFormLink({
        userEmail: $.user.email,
        executionId: $.execution.id,
        blacklistedRecipients,
      })
      const solution = `The following email addresses have been blacklisted by Postman:
         \n${blacklistedRecipients
           .map((recipient) => `**${recipient}**`)
           .join('\n\n')}
         \nIf you believe that they are valid and active, please [use this form](${formLink}) to request for removal from blacklist and try again.
        `
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
      throw new StepError(
        'Rate limit exceeded',
        'Too many emails are being sent. Please wait for a while before retrying.',
        position,
        appName,
        error,
      )
    case 'INVALID-ATTACHMENT':
      throw new StepError(
        'Unsupported attachment file type',
        'Click on set up action and check that the attachment type is supported by postman. Please check the supported types at [this link](https://guide.postman.gov.sg/email-api-guide/programmatic-email-api/send-email-api/attachments#list-of-supported-attachment-file-types).',
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
      throw new StepError(
        'Something went wrong',
        'Please contact plumber@open.gov.sg for assistance.',
        position,
        appName,
        error,
      )
  }
}
