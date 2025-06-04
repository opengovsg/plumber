import type { IApp } from '@plumber/types'

import RetriableError from '@/errors/retriable-error'
import StepError from '@/errors/step'
import { parseRetryAfterToMs } from '@/helpers/parse-retry-after-to-ms'

type ThrowingHandler = (
  ...args: Parameters<IApp['requestErrorHandler']>
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
      if (error.message === 'read ETIMEDOUT') {
        throw new RetriableError({
          error: `Retrying ${error.message} from Postman SMS`,
          // pausing the entire queue here is not a good idea because we wont be able to fully utilize
          // the throughput that the campaign supports, so we throw step error here instead of group
          delayType: 'step',
          delayInMs: 'default',
        })
      }

      if (error.response.data.error?.code === 'parameter_invalid') {
        throw new StepError(
          'Campaign template was not set up correctly',
          'Ensure that you have followed the instructions in our guide to set up your campaign template.',
          $.step.position,
          $.app.name,
        )
      }

      throw new StepError(
        'Error sending SMS',
        error.message,
        $.step.position,
        $.app.name,
      )
  }
}

export default requestErrorHandler
