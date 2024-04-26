import { IGlobalVariable } from '@plumber/types'

import get from 'lodash.get'

import HttpError from '@/errors/http'
import RetriableError from '@/errors/retriable-error'
import StepError from '@/errors/step'
import Step, { StepContext } from '@/models/step'

export async function throwSendMessageError(
  err: HttpError,
  step: IGlobalVariable['step'],
  appName: string,
  testRun: boolean,
): Promise<never> {
  const position = step.position
  // catch telegram errors with different error format for ETIMEDOUT and ECONNRESET: e.g. details: { error: 'connect ECONNREFUSED 127.0.0.1:3002' }
  const errorString = JSON.stringify(get(err, 'details.error', ''))
  if (errorString.includes('ECONNRESET') || errorString.includes('ETIMEDOUT')) {
    throw new StepError(
      'Connection issues',
      'Please retry in a few minutes because telegram is currently experiencing issues.',
      position,
      appName,
      err,
    )
  }

  // catch telegram errors with proper http error format
  switch (err.response.status) {
    case 400:
      // many sub errors caught by telegram for this status
      // eslint-disable-next-line no-case-declarations
      const errorString = JSON.stringify(get(err, 'details.description', ''))
      if (errorString.includes('not enough rights')) {
        throw new StepError(
          'No permission for bot',
          'Please give permission for your bot in telegram to send messages in the group chat used in your action.',
          position,
          appName,
          err,
        )
      } else if (errorString.includes('supergroup')) {
        // SPECIAL CASE: fix chat id for user if pipe is published
        if (!testRun) {
          const oldChatId: string = step.parameters.chatId as string
          const newChatId: string =
            err.response.data.parameters['migrate_to_chat_id']
          if (!newChatId) {
            throw err // uncaught error
          }

          await Step.query()
            .patchAndFetchById(step.id, {
              parameters: {
                ...step.parameters,
                chatId: newChatId,
              },
            })
            .context({
              shouldBypassBeforeUpdateHook: true,
            } as StepContext)

          // Refactoring Telegram in later PR. Keeping retry as status quo in this PR.
          throw new RetriableError({
            error: `Upgrade from current chat id: ${oldChatId} to supergroup chat id: ${newChatId} and retry`,
            delayInMs: 'default',
            delayType: 'step',
          })
        }
        // for test runs, still throw back stepError
        throw new StepError(
          'Supergroup chat upgrade',
          'Please re-connect the chat ID because chat ID changes when your group gets upgraded to a supergroup chat.',
          position,
          appName,
          err,
        )
      } else if (errorString.includes('chat not found')) {
        throw new StepError(
          'Incorrect bot configuration',
          'Click on set up action and check that a valid chat ID is used. Otherwise, remove and re-add the bot into the group. Make sure that you send a message to the bot before the bot can send messages to you.',
          position,
          appName,
          err,
        )
      } else {
        // return original error since uncaught
        throw err
      }
    case 403:
      throw new StepError(
        'Forbidden',
        'Check that the bot is added in the group chat used in your action.',
        position,
        appName,
        err,
      )
    case 429:
      throw new StepError(
        'Rate limit exceeded',
        'Too many messages are being sent. Please wait for a minute before retrying and avoid sending more than 20 messages per minute to the same group.',
        position,
        appName,
        err,
      )
    default:
      // return original error since uncaught
      throw err
  }
}
