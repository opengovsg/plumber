import type { StepErrorKind } from '@plumber/types'
import { z } from 'zod'

import HttpError, { isNetworkError } from '@/errors/http'
import StepError, { GenericSolution } from '@/errors/step'

interface TwilioStepErrorInfo {
  name: string
  solution: string
  kind: StepErrorKind
}

const TRY_AGAIN_LATER = 'Try again later.'

// Each code's Twilio docs page names only the step's own values or the user's Twilio account as causes.
// https://www.twilio.com/docs/api/errors/<code>
const USER_FIXABLE_TWILIO_ERROR_CODES = new Set([
  21211, // Invalid 'To' phone number
  21212, // Invalid 'From' number
  21266, // 'To' and 'From' numbers cannot be the same
  21408, // Geo permissions disabled for the destination region
  21602, // Message body is required
  21603, // 'From' or 'MessagingServiceSid' is required
  21604, // 'To' phone number is required
  21606, // 'From' number is not a message-capable number for this account
  21608, // Trial account cannot message unverified numbers
  21610, // Recipient has unsubscribed
  21614, // 'To' number is not a valid mobile number
  21617, // Message body exceeds 1600 characters
])

// https://www.twilio.com/docs/usage/twilios-response
const twilioErrorBodySchema = z.object({
  code: z.number(),
  message: z.string(),
})

function getTwilioErrorBody(
  error: HttpError,
): z.infer<typeof twilioErrorBodySchema> | undefined {
  const result = twilioErrorBodySchema.safeParse(error.response.data)
  return result.success ? result.data : undefined
}

function getTwilioStepErrorInfo(error: HttpError): TwilioStepErrorInfo {
  const status = error.response.status

  if (status === undefined) {
    return isNetworkError(error)
      ? {
          name: 'Could not connect to Twilio',
          solution: TRY_AGAIN_LATER,
          kind: 'third-party',
        }
      : {
          name: 'Could not send the request to Twilio',
          solution: TRY_AGAIN_LATER,
          kind: 'internal',
        }
  }

  const body = getTwilioErrorBody(error)

  if (
    status === 400 &&
    body &&
    USER_FIXABLE_TWILIO_ERROR_CODES.has(body.code)
  ) {
    return {
      name: `Twilio rejected this SMS: ${body.message}`,
      solution: `${GenericSolution.ReconfigureInvalidField} See https://www.twilio.com/docs/api/errors/${body.code} for details.`,
      kind: 'config',
    }
  }

  switch (status) {
    case 401:
      return {
        name: 'Twilio did not accept your credentials',
        solution:
          'Check that your Twilio Account SID and Auth Token or API key are still active, then reconnect your Twilio connection.',
        kind: 'config',
      }
    case 403:
      return {
        name: 'Your Twilio credentials do not have permission to send SMS',
        solution:
          'Check the permissions of your Twilio account or API key, then reconnect your Twilio connection.',
        kind: 'config',
      }
    case 404:
      return {
        name: 'Twilio could not find your account',
        solution:
          'Check the Account SID in your Twilio connection, then reconnect it.',
        kind: 'config',
      }
    case 429:
      return {
        name: 'Too many requests sent to Twilio',
        solution: TRY_AGAIN_LATER,
        kind: 'internal',
      }
  }

  if (status >= 500) {
    return {
      name: 'Twilio is unavailable',
      solution: TRY_AGAIN_LATER,
      kind: 'third-party',
    }
  }

  const prefix = `Twilio rejected the request (HTTP ${status})`
  return {
    name: body ? `${prefix}: ${body.message}` : prefix,
    solution: TRY_AGAIN_LATER,
    kind: 'internal',
  }
}

export function rethrowAsTwilioStepError(error: unknown): never {
  if (error instanceof HttpError) {
    throw new StepError({ ...getTwilioStepErrorInfo(error), cause: error })
  }
  throw error
}
