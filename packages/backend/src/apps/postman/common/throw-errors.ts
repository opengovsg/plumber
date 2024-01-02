import HttpError from '@/errors/http'
import StepError from '@/errors/step'

type PostmanApiErrorData = {
  code: string
  message: string
}

export function throwSendEmailError(
  error: HttpError,
  position: number,
  appName: string,
): never {
  const postmanErrorData: PostmanApiErrorData = error.response.data
  const { code: errorCode, message: errorMessage } = postmanErrorData
  // catch common postman error codes and provide solution
  switch (errorCode) {
    case 'invalid_template':
      if (errorMessage.includes('attachments')) {
        throw new StepError(
          'Unsupported attachment file type',
          'Click on set up action and check that the attachment type is supported by postman. Please check the supported types at [this link](https://guide.postman.gov.sg/email-api-guide/programmatic-email-api/send-email-api/attachments#list-of-supported-attachment-file-types).',
          position,
          appName,
          error,
        )
      } else if (errorMessage.includes('blacklisted')) {
        throw new StepError(
          'Blacklisted recipient email',
          'Please request for the recipient email to be whitelisted at [this link](https://guide.postman.gov.sg/api-guide/programmatic-email-api/send-email-api/recipient-blacklist).',
          position,
          appName,
          error,
        )
      } else {
        // return original error if not caught
        throw error
      }
    case 'rate_limit':
      throw new StepError(
        'Too many requests',
        'Please retry the failed execution after a minute.',
        position,
        appName,
        error,
      )
    case 'service_unavailable':
      throw new StepError(
        'Twilio service is currently unavailable',
        'Please retry the failed execution after a few minutes.',
        position,
        appName,
        error,
      )
    default:
      // return original error if not caught
      throw error
  }
}
