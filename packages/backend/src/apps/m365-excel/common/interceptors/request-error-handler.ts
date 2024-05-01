import type { IApp } from '@plumber/types'

import RetriableError from '@/errors/retriable-error'
import logger from '@/helpers/logger'
import { parseRetryAfterToMs } from '@/helpers/parse-retry-after-to-ms'

import { getGraphApiType, GraphApiType } from '../graph-api-type'
import { tryParseGraphApiError } from '../parse-graph-api-error'

type ThrowingHandler = (
  ...args: Parameters<IApp['requestErrorHandler']>
) => never

//
// Handle MS rate limiting us
//
const handle429: ThrowingHandler = ($, error) => {
  const retryAfterMs =
    parseRetryAfterToMs(error.response?.headers?.['retry-after']) ?? 'default'

  // Edge case: Thus far, _only_ 429s from the Excel endpoint are retriable
  // because Microsoft applies dynamic rate limits for Excel, and we've verified
  // with GovTech that these 429s have no impact on other M365 users.
  //
  // https://learn.microsoft.com/en-us/graph/workbook-best-practice?tabs=http#reduce-throttling-errors
  //
  // Since they apply per-file, we delay only the group when retrying.
  if (getGraphApiType(error.response.config.url) === GraphApiType.Excel) {
    throw new RetriableError({
      error: 'Retrying HTTP 429 from Excel endpoint',
      delayType: 'group',
      delayInMs: retryAfterMs,
    })
  }

  // A 429 response may be considered a SEV-2+ incident for some tenants; log it
  // explicitly so that we can easily trigger incident creation from DD.
  logger.error('Received HTTP 429 from MS Graph', {
    event: 'm365-http-429',
    tenant: $.auth?.data?.tenantKey as string,
    baseUrl: error.response.config.baseURL,
    url: error.response.config.url,
    flowId: $.flow?.id,
    stepId: $.step?.id,
    executionId: $.execution?.id,
    graphApiError: tryParseGraphApiError(error),
  })

  // We jam the whole queue to enable recovery.
  throw new RetriableError({
    error: 'Rate limited by Microsoft Graph.',
    delayType: 'queue',
    delayInMs: retryAfterMs,
  })
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
  const retryAfterMs =
    parseRetryAfterToMs(error.response?.headers?.['retry-after']) ?? 'default'
  throw new RetriableError({
    error: 'Encountered HTTP 503 from MS',
    delayInMs: retryAfterMs,
    // From past data, 503s happen only for a single request, so we can just
    // retry this individual step instead of jamming the group.
    delayType: 'step',
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
    graphApiError: tryParseGraphApiError(error),
  })

  // We jam the entire queue to enable recovery.
  const retryAfterMs =
    parseRetryAfterToMs(error.response?.headers?.['retry-after']) ?? 'default'
  throw new RetriableError({
    error: 'Bandwidth limited by Microsoft Graph.',
    delayType: 'queue',
    delayInMs: retryAfterMs,
  })
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
