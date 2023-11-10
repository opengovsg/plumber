import HttpError from '@/errors/http'
import { generateHttpStepError } from '@/helpers/generate-step-error'

type PostmanApiErrorData = {
  code: string
  message: string
}

export function throwSendEmailError(
  error: HttpError,
  position: number,
  appName: string,
): never {
  let stepErrorSolution = ''
  const postmanErrorData: PostmanApiErrorData = error.response.data
  const errorCode = postmanErrorData.code
  // catch common errors by users and provide solution
  if (errorCode === 'invalid_template') {
    stepErrorSolution =
      'Recipient email is blacklisted. Please request for the recipient email to be whitelisted at: https://guide.postman.gov.sg/api-guide/programmatic-email-api/send-email-api/recipient-blacklist.'
  } else if (errorCode === 'rate_limit') {
    stepErrorSolution =
      'Too many requests were made, please retry the failed execution after a minute.'
  } else if (errorCode === 'service_unavailable') {
    stepErrorSolution =
      'Twilio service is currently unavailable, please retry the failed execution after a few minutes.'
  } else {
    // return original error if not caught
    throw error
  }

  throw generateHttpStepError(error, stepErrorSolution, position, appName)
}
