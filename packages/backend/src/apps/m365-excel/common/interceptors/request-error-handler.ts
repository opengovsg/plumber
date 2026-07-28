import type { IApp } from '@plumber/types'

import RetriableError from '@/errors/retriable-error'
import StepError from '@/errors/step'
import logger from '@/helpers/logger'
import { parseRetryAfterToMs } from '@/helpers/parse-retry-after-to-ms'

import { getLastHitGraphApiType, GraphApiType } from '../graph-api-type'
import { tryParseGraphApiError } from '../parse-graph-api-error'

type ThrowingHandler = (
  ...args: Parameters<IApp['requestErrorHandler']>
) => never

type MaybeThrowingHandler = (
  ...args: Parameters<IApp['requestErrorHandler']>
) => never | void

const handleIntermittentError: MaybeThrowingHandler = ($, error) => {
  if (error.code === 'ETIMEDOUT') {
    throw new RetriableError({
      error: `Retrying ETIMEDOUT ${error.message} from M365 Excel`,
      delayType: 'step',
      delayInMs: 'default',
    })
  }
}
//
// Unknown intermittent error from m365
//
const handle404: ThrowingHandler = ($, error) => {
  const graphApiError = tryParseGraphApiError(error)
  if (!graphApiError) {
    throw error
  }
  // We only want to retry this specific error since it's a temporary blip
  if (
    graphApiError.code !== 'ResourceNotFound' ||
    graphApiError.message !== 'Invalid version: error'
  ) {
    throw error
  }

  logger.error('Received HTTP 404 from MS Graph', {
    event: 'm365-http-404-invalid-version',
    tenant: $.auth?.data?.tenantKey as string,
    baseUrl: error.response.config.baseURL,
    url: error.response.config.url,
    flowId: $.flow?.id,
    stepId: $.step?.id,
    executionId: $.execution?.id,
    graphApiError,
  })

  throw new RetriableError({
    error: 'Retrying HTTP 404 from M365 Excel',
    delayType: 'step',
    delayInMs: 'default',
  })
}

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
  if (
    getLastHitGraphApiType(error.response.config.url) === GraphApiType.Excel
  ) {
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
const handle500and502and503: ThrowingHandler = function ($, error) {
  // Log to monitor spikes, just in case
  const status = error.response.status
  logger.warn(`Received HTTP ${status} from MS Graph`, {
    event: `m365-http-${status}`,
    tenant: $.auth?.data?.tenantKey as string,
    baseUrl: error.response.config.baseURL,
    url: error.response.config.url,
    flowId: $.flow?.id,
    stepId: $.step?.id,
    executionId: $.execution?.id,
    retryAfterMs: error.response?.headers?.['retry-after'],
  })

  // Microsoft _sometimes_ specifies a Retry-After when it returns 503.
  const retryAfterMs =
    parseRetryAfterToMs(error.response?.headers?.['retry-after']) ?? 'default'
  throw new RetriableError({
    error: `Encountered HTTP ${status} from MS`,
    delayInMs: retryAfterMs,
    // From past data, 503s happen only for a single request, so we can just
    // retry this individual step instead of jamming the group.
    delayType: 'step',
  })
}

//
// Handle 504 Gateway Timeout - typically caused by long-running formulas.
// Test runs: fail immediately with helpful message.
// Live runs: retry up to 3 times, then fail with helpful message.
//
export const EXCEL_504_MAX_ATTEMPTS = 3
const EXCEL_504_ERROR_MESSAGE = {
  name: 'Excel request timed out',
  solution: `This usually happens for one of two reasons:

1. **Unnecessary formatting is bloating your file size.**
   - Fix: Review > Check Performance > Optimize Sheet.

2. **Your file has long-running or complex formulas.**
   - Fix: Simplify the formulas, or set the calculation mode to Manual (Formulas tab > Calculation Options).`,
}

const handle504: ThrowingHandler = function ($, error) {
  logger.warn('Received HTTP 504 from MS Graph', {
    event: 'm365-http-504',
    tenant: $.auth?.data?.tenantKey as string,
    baseUrl: error.response.config.baseURL,
    url: error.response.config.url,
    flowId: $.flow?.id,
    stepId: $.step?.id,
    executionId: $.execution?.id,
  })

  // For test runs, fail immediately with user-friendly message
  if ($.execution?.testRun) {
    throw new StepError(
      EXCEL_504_ERROR_MESSAGE.name,
      EXCEL_504_ERROR_MESSAGE.solution,
    )
  }

  // For live runs, throw RetriableError with user-friendly message
  // The message will be saved as errorDetails, so it's correct from the start
  throw new RetriableError({
    error: EXCEL_504_ERROR_MESSAGE,
    delayType: 'step',
    delayInMs: 'default',
    maxAttempts: EXCEL_504_MAX_ATTEMPTS,
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
    case 404: // Not found error (specifically Invalid version error blip, caused by intermittent m365 error)
      return handle404($, error)
    case 429: // Rate limited
      return handle429($, error)
    case 500:
    case 502: // Bad gateway
    case 503: // Transient error
      return handle500and502and503($, error)
    case 504: // Gateway timeout - likely due to long-running formulas
      return handle504($, error)
    case 509: // Bandwidth limit reached
      return handle509($, error)
    default:
      handleIntermittentError($, error)
      throw error
  }
}

export default errorHandler
