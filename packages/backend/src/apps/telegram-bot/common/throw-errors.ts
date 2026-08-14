import { IGlobalVariable } from '@plumber/types'

import get from 'lodash.get'
import { raw } from 'objection'

import HttpError from '@/errors/http'
import RetriableError from '@/errors/retriable-error'
import StepError from '@/errors/step'
import logger from '@/helpers/logger'
import Step, { StepContext } from '@/models/step'

export async function throwSendMessageError(
  err: HttpError,
  step: IGlobalVariable['step'],
  testRun: boolean,
): Promise<never> {
  // catch telegram errors with different error format for ETIMEDOUT and ECONNRESET: e.g. details: { error: 'connect ECONNREFUSED 127.0.0.1:3002' }
  const errorDetails = JSON.stringify(get(err, 'details', {}))
  const errorString = JSON.stringify(get(err, 'details.error', ''))
  logger.error({
    event: 'telegram-bot-error',
    error: errorDetails,
    stepId: step.id,
    testRun,
  })

  if (
    errorString.includes('ECONNRESET') ||
    errorString.includes('ETIMEDOUT') ||
    err.message.includes('ETIMEDOUT') ||
    err.code === 'ETIMEDOUT' ||
    errorString.includes('socket hang up')
  ) {
    logger.error(`Telegram ip error: ${err.resolvedIp}`)
    throw new RetriableError({
      error: 'Timeout error. Telegram may be experiencing issues.',
      delayInMs: 'default',
      delayType: 'step',
    })
  }

  /**
   * TODO: Temporary error handling since I cant find a way to catch the ETIMEDOUT error
   */
  if (errorDetails === '{"error": "Error"}') {
    throw new RetriableError({
      error: 'Timeout error. Telegram may be experiencing issues.',
      delayInMs: 'default',
      delayType: 'step',
    })
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

          // `step.parameters` here is the resolved, per-run copy (see
          // computeParameters in services/action.ts), not the persisted
          // config. Merge chatId into the DB row's parameters directly via
          // a jsonb `||` so we patch the actual stored value atomically,
          // instead of spreading stale/resolved in-memory parameters back.
          await Step.query()
            .patchAndFetchById(step.id, {
              parameters: raw('?? || ?::jsonb', [
                'parameters',
                JSON.stringify({ chatId: newChatId }),
              ]),
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
          err,
        )
      } else if (errorString.includes('chat not found')) {
        throw new StepError(
          'Incorrect bot configuration',
          'Check that a valid chat ID is used. Otherwise, remove and re-add the bot into the group. Make sure that you send a message to the bot before the bot can send messages to you.',
          err,
        )
      } else if (errorString.includes('message thread not found')) {
        throw new StepError(
          'Incorrect topic configuration',
          'Check that a valid topic ID is used.',
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
        err,
      )
    case 429:
      throw new StepError(
        'Rate limit exceeded',
        'Too many messages are being sent. Please wait for a minute before retrying and avoid sending more than 20 messages per minute to the same group.',
        err,
      )
    case 504:
      throw new RetriableError({
        error: 'Timeout error. Telegram may be experiencing issues.',
        delayInMs: 'default',
        delayType: 'step',
      })
    default:
      // return original error since uncaught
      throw err
  }
}
