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

const requestErrorHandler: IApp['requestErrorHandler'] = async function (
  $,
  error,
) {
  if (error.response.status === 429) {
    return handle429($, error)
  }

  if (
    error.response.status === 400 &&
    error.response.data.error?.code === 'parameter_invalid'
  ) {
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

export default requestErrorHandler
