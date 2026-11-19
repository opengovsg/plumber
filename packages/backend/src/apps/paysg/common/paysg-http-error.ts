import type { StepErrorKind } from '@plumber/types'
import { z } from 'zod'

import HttpError, { isNetworkError } from '@/errors/http'
import StepError, { GenericSolution } from '@/errors/step'

interface PaySgStepErrorInfo {
  name: string
  solution: string
  kind: StepErrorKind
}

// https://guide.pay.gov.sg/start-an-api-integration/errors
const paySgErrorBodySchema = z.object({
  error: z.object({ message: z.string() }),
})

function withPaySgMessage(prefix: string, error: HttpError): string {
  const body = paySgErrorBodySchema.safeParse(error.response.data)
  return body.success && body.data.error.message
    ? `${prefix}: ${body.data.error.message}`
    : prefix
}

// PaySG documents each listed 4xx as caused by the request's own values or the user's PaySG account.
function getPaySgStepErrorInfo(error: HttpError): PaySgStepErrorInfo {
  const status = error.response.status

  if (status === undefined) {
    return isNetworkError(error)
      ? {
          name: 'Could not connect to PaySG',
          solution: 'Try again later.',
          kind: 'third-party',
        }
      : {
          name: 'Could not send the request to PaySG',
          solution: 'Try again later.',
          kind: 'internal',
        }
  }

  switch (status) {
    case 400:
      return {
        name: withPaySgMessage('PaySG rejected a field value', error),
        solution: GenericSolution.ReconfigureInvalidField,
        kind: 'config',
      }
    case 401:
      return {
        name: 'PaySG did not accept your API key',
        solution:
          'Check that your PaySG API key is still active, then reconnect your PaySG connection.',
        kind: 'config',
      }
    case 402:
      return {
        name: withPaySgMessage('PaySG could not process this request', error),
        solution:
          'Check that your PaySG payment service is fully set up, e.g. connected to Stripe, then try again.',
        kind: 'config',
      }
    case 403:
      return {
        name: 'Your PaySG API key does not have permission for this action',
        solution:
          'Check the permissions of your PaySG API key, then reconnect your PaySG connection.',
        kind: 'config',
      }
    case 404:
      return {
        name: 'PaySG could not find the payment, form or payment service',
        solution:
          'Check that the payment ID or form ID in this step exists in your PaySG payment service.',
        kind: 'config',
      }
    case 429:
      return {
        name: 'Too many requests sent to PaySG',
        solution: 'Try again later.',
        kind: 'internal',
      }
  }

  if (status >= 500) {
    return {
      name: 'PaySG is unavailable',
      solution: 'Try again later.',
      kind: 'third-party',
    }
  }

  return {
    name: withPaySgMessage(
      `PaySG rejected the request (HTTP ${status})`,
      error,
    ),
    solution: 'Try again later.',
    kind: 'internal',
  }
}

export function rethrowAsPaySgStepError(error: unknown): never {
  if (error instanceof HttpError) {
    throw new StepError({ ...getPaySgStepErrorInfo(error), cause: error })
  }
  throw error
}
