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
  // Edge case: Thus far, _only_ 429s from the Excel endpoint are retriable
  // because Microsoft applies dynamic rate limits for Excel, and we've verified
  // with GovTech that these 429s have no impact on other M365 users.
  //
  // https://learn.microsoft.com/en-us/graph/workbook-best-practice?tabs=http#reduce-throttling-errors
  //
  // Excel endpoints are uniquely identified by the `/workbook/` url segment.
  //
  // FIXME (ogp-weeloong): eval if we can remove this and just retry _all_ 429s
  // once we get bullmq pro in.
  if (error.response.config.url.includes('/workbook/')) {
    const retryAfterMs = Number(error.response?.headers?.['retry-after']) * 1000
    throw new RetriableError({
      error: 'Retrying HTTP 429 from Excel endpoint',
      delayInMs: isNaN(retryAfterMs) ? 'default' : retryAfterMs,
    })
  }

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
