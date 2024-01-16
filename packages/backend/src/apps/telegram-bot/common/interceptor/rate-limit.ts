import type { IApp } from '@plumber/types'

import logger from '@/helpers/logger'

const ADDITONAL_RATE_LIMIT_IN_SEC = 45

const rateLimitHandler: IApp['requestErrorHandler'] = async function (
  $,
  error,
) {
  if (error.response.status !== 429) {
    return // use default error handling
  }

  const retryAfter = +error.response.headers['retry-after']
  if (isNaN(retryAfter)) {
    return
  }

  const newRetryAfter = retryAfter + ADDITONAL_RATE_LIMIT_IN_SEC

  logger.error('Telegram rate limit error', {
    executionId: $.execution.id,
    flowId: $.flow.id,
    stepId: $.step.id,
    data: error.response.data,
    headers: error.response.headers,
    oldRetryAfter: retryAfter,
    newRetryAfter,
  })

  error.response.headers['retry-after'] = newRetryAfter.toString()
  throw error
}

export default rateLimitHandler
