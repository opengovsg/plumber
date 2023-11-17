import get from 'lodash.get'

import HttpError from '@/errors/http'
import { generateHttpStepError } from '@/helpers/generate-step-error'

export function throwSendMessageError(
  err: HttpError,
  position: number,
  appName: string,
): never {
  let stepErrorSolution = ''

  // catch telegram errors with different error format for ETIMEDOUT and ECONNRESET: e.g. details: { error: 'connect ECONNREFUSED 127.0.0.1:3002' }
  const errorString = JSON.stringify(get(err, 'details.error', ''))
  if (errorString.includes('ECONNRESET') || errorString.includes('ETIMEDOUT')) {
    stepErrorSolution =
      'Please retry in a few minutes because telegram is currently experiencing issues.'
    throw generateHttpStepError(err, stepErrorSolution, position, appName)
  }

  // catch telegram errors with proper http error format
  const status = err.response.status
  if (status === 400) {
    // many sub errors caught by telegram for this status
    const errorString = JSON.stringify(get(err, 'details.description', ''))
    if (errorString.includes('not enough rights')) {
      stepErrorSolution =
        'Please give permission for your bot in telegram to send messages in the group chat used in your action.'
    } else if (errorString.includes('supergroup')) {
      stepErrorSolution =
        'Please re-connect the chat ID because chat ID changes when your group gets upgraded to a supergroup chat.'
    } else if (errorString.includes('chat not found')) {
      stepErrorSolution =
        'Click on set up action and check that a valid chat ID is used. Otherwise, remove and re-add the bot into the group. Make sure that you send a message to the bot before the bot can send messages to you.'
    }
  } else if (status === 403) {
    stepErrorSolution =
      'Check that the bot is added in the group chat used in your action.'
  } else if (status === 429) {
    stepErrorSolution =
      'Too many messages are being sent. Please wait for a minute before retrying and avoid sending more than 20 messages per minute to the same group.'
  } else {
    // return original error since uncaught
    throw err
  }
  throw generateHttpStepError(err, stepErrorSolution, position, appName)
}
