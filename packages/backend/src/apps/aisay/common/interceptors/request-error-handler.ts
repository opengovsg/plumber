import { IApp } from '@plumber/types'

import RetriableError from '@/errors/retriable-error'
import logger from '@/helpers/logger'
import { parseRetryAfterToMs } from '@/helpers/parse-retry-after-to-ms'

type ThrowingHandler = (
  ...args: Parameters<IApp['requestErrorHandler']>
) => never

// Retry failures
const handle503: ThrowingHandler = function ($, error) {
  const status = error.response.status
  logger.warn('Received HTTP 503 from AISAY', {
    event: 'aisay-http-503',
    clientId: $.auth.data.clientId,
    baseUrl: error.response.config.baseURL,
    url: error.response.config.url,
    flowId: $.flow?.id,
    stepId: $.step?.id,
    executionId: $.execution?.id,
    retryAfterMs: error.response?.headers?.['retry-after'],
  })

  // AISAY will specify a Retry-After header when it returns 503.
  const retryAfterMs =
    parseRetryAfterToMs(error.response?.headers?.['retry-after']) ?? 'default'
  throw new RetriableError({
    error: `Encountered HTTP ${status} from AISAY`,
    delayInMs: retryAfterMs,
    delayType: 'step',
  })
}

const errorHandler: IApp['requestErrorHandler'] = async function ($, error) {
  switch (error.response.status) {
    case 503:
      return handle503($, error)
  }
}

export default errorHandler
