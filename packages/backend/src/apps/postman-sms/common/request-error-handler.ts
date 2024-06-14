import type { IApp } from '@plumber/types'

import RetriableError from '@/errors/retriable-error'
import { parseRetryAfterToMs } from '@/helpers/parse-retry-after-to-ms'

type ThrowingHandler = (
  ...args: Parameters<IApp['requestErrorHandler']>
) => never

const handle429: ThrowingHandler = ($, error) => {
  const retryAfterMs =
    parseRetryAfterToMs(error.response?.headers?.['retry-after']) ?? 'default'

  throw new RetriableError({
    error: 'Retrying HTTP 429 from Postman SMS',
    delayType: 'group',
    delayInMs: retryAfterMs,
  })
}

const requestErrorHandler: IApp['requestErrorHandler'] = async function (
  $,
  error,
) {
  if (error.response.status === 429) {
    return handle429($, error)
  }

  // No-op for non-429; our Axios interceptor will re-throw the original
  // HttpError
}

export default requestErrorHandler
