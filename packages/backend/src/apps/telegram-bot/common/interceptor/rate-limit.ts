import type { IApp } from '@plumber/types'

import logger from '@/helpers/logger'

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

  logger.error('Telegram rate limit error', {
    executionId: $.execution.id,
    flowId: $.flow.id,
    stepId: $.step.id,
    data: error.response.data,
    headers: error.response.headers,
    oldRetryAfter: retryAfter,
    newRetryAfter: retryAfter + 30,
  })

  error.response.headers['retry-after'] = `${retryAfter + 30}`
  throw error
}

export default rateLimitHandler
