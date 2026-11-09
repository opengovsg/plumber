import type { IApp, StepErrorKind } from '@plumber/types'

import HttpError from '@/errors/http'
import RetriableError from '@/errors/retriable-error'
import StepError, { GenericSolution } from '@/errors/step'
import { parseRetryAfterToMs } from '@/helpers/parse-retry-after-to-ms'

type ThrowingHandler = (
  ...args: Parameters<NonNullable<IApp['requestErrorHandler']>>
) => never

const handle429: ThrowingHandler = (_, error): never => {
  const retryAfterMs =
    parseRetryAfterToMs(error.response?.headers?.['retry-after']) ?? 'default'

  throw new RetriableError({
    error: 'Retrying HTTP 429 from Postman SMS',
    // pausing the entire queue here is not a good idea because we wont be able to fully utilize
    // the throughput that the campaign supports, so we throw step error here instead of group
    delayType: 'step',
    delayInMs: retryAfterMs,
  })
}

const handle5xxErrors: ThrowingHandler = (_, error): never => {
  const status = error.response.status
  throw new RetriableError({
    error: `Retrying HTTP ${status} from Postman SMS`,
    delayType: 'step',
    delayInMs: 'default',
  })
}

// Other 4xx codes are Plumber bugs or ambiguous, e.g. 403 covers archived campaigns and Postman role failures.
function getCatchAllKind(error: HttpError): StepErrorKind {
  const status = error.response.status
  if (status === undefined) {
    return error.code ? 'third-party' : 'internal'
  }
  return status >= 500 ? 'third-party' : 'internal'
}

const requestErrorHandler: IApp['requestErrorHandler'] = async function (
  $,
  error,
) {
  switch (error.response.status) {
    case 429:
      return handle429($, error)
    case 500:
    case 502:
    case 503:
    case 520: // Cloudflare-specific error
    case 524: // Cloudflare-specific error
      return handle5xxErrors($, error)
    default:
      if (error.code === 'ETIMEDOUT' || error.message.includes('ETIMEDOUT')) {
        throw new RetriableError({
          error: `Retrying ${error.message} from Postman SMS`,
          // pausing the entire queue here is not a good idea because we wont be able to fully utilize
          // the throughput that the campaign supports, so we throw step error here instead of group
          delayType: 'step',
          delayInMs: 'default',
        })
      }

      if (error.response.data?.error?.code === 'parameter_invalid') {
        throw new StepError({
          name: 'Campaign template was not set up correctly',
          solution:
            'Ensure that you have followed the instructions in our guide to set up your campaign template.',
          kind: 'config',
        })
      }

      if (error.response.data?.error?.code === 'invalid_api_key_provided') {
        throw new StepError({
          name: 'Invalid Postman API key',
          solution: GenericSolution.MalformedConnectionData,
          kind: 'config',
        })
      }

      if (error.response.data?.error?.code === 'invalid_ip_address_used') {
        throw new StepError({
          name: "Plumber's IPs are not whitelisted in your campaign",
          solution:
            "Add Plumber's IP addresses to your API key's IP whitelist in Postman, then try again.",
          kind: 'config',
        })
      }

      throw new StepError({
        name: 'Error sending SMS',
        solution: error.message,
        kind: getCatchAllKind(error),
        cause: error,
      })
  }
}

export default requestErrorHandler
