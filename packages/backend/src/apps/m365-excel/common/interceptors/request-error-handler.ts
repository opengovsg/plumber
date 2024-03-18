import type { IApp } from '@plumber/types'

import RetriableError from '@/errors/retriable-error'
import logger from '@/helpers/logger'

type ThrowingHandler = (
  ...args: Parameters<IApp['requestErrorHandler']>
) => never

//
// Handle MS rate limiting us
//
const handle429: ThrowingHandler = ($, error) => {
  // A 429 response is considered a SEV-2+ incident for some tenants; log it
  // explicitly so that we can easily trigger incident creation from DD.
  logger.error('Received HTTP 429 from MS Graph', {
    event: 'm365-http-429',
    tenant: $.auth?.data?.tenantKey as string,
    baseUrl: error.response.config.baseURL,
    url: error.response.config.url,
    flowId: $.flow?.id,
    stepId: $.step?.id,
    executionId: $.execution?.id,
  })

  // We don't want to retry 429s from M365, so convert it into a non-HttpError.
  throw new Error('Rate limited by Microsoft Graph.')
}

//
// Retry failures due to flakey M365 servers
//
const handle503: ThrowingHandler = function ($, error) {
  // Log to monitor spikes, just in case
  logger.warn('Received HTTP 503 from MS Graph', {
    event: 'm365-http-503',
    tenant: $.auth?.data?.tenantKey as string,
    baseUrl: error.response.config.baseURL,
    url: error.response.config.url,
    flowId: $.flow?.id,
    stepId: $.step?.id,
    executionId: $.execution?.id,
  })

  // Microsoft _sometimes_ specifies a Retry-After when it returns 503.
  const retryAfterMs = Number(error.response?.headers?.['retry-after']) * 1000
  throw new RetriableError({
    error: 'Encountered HTTP 503 from MS',
    delayInMs: isNaN(retryAfterMs) ? 'default' : retryAfterMs,
  })
}

//
// Handle exceeding bandwidth limit
//
const handle509: ThrowingHandler = function ($, error) {
  logger.error('Received HTTP 509 from MS Graph', {
    event: 'm365-http-509',
    tenant: $.auth?.data?.tenantKey as string,
    baseUrl: error.response.config.baseURL,
    url: error.response.config.url,
    flowId: $.flow?.id,
    stepId: $.step?.id,
    executionId: $.execution?.id,
  })

  // We don't want to retry 509s from M365, so convert it into a non-HttpError.
  throw new Error('Bandwidth limited by Microsoft Graph.')
}

const errorHandler: IApp['requestErrorHandler'] = async function ($, error) {
  switch (error.response.status) {
    case 429: // Rate limited
      return handle429($, error)
    case 503: // Transient error
      return handle503($, error)
    case 509: // Bandwidth limit reached
      return handle509($, error)
  }
}

export default errorHandler
