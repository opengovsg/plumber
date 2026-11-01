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

  // catch telegram errors with proper http error format
  switch (err.response.status) {
    case 400:
      // many sub errors caught by telegram for this status
      // oxlint-disable-next-line no-case-declarations
      const errorString = JSON.stringify(get(err, 'details.description', ''))
      if (errorString.includes('not enough rights')) {
        throw new StepError({
          name: 'No permission for bot',
          solution:
            'Please give permission for your bot in telegram to send messages in the group chat used in your action.',
          kind: 'config',
          cause: err,
        })
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
        throw new StepError({
          name: 'Supergroup chat upgrade',
          solution:
            'Please re-connect the chat ID because chat ID changes when your group gets upgraded to a supergroup chat.',
          kind: 'config',
          cause: err,
        })
      } else if (errorString.includes('chat not found')) {
        throw new StepError({
          name: 'Incorrect bot configuration',
          solution:
            'Check that a valid chat ID is used. Otherwise, remove and re-add the bot into the group. Make sure that you send a message to the bot before the bot can send messages to you.',
          kind: 'config',
          cause: err,
        })
      } else if (errorString.includes('message thread not found')) {
        throw new StepError({
          name: 'Incorrect topic configuration',
          solution: 'Check that a valid topic ID is used.',
          kind: 'config',
          cause: err,
        })
      } else if (errorString.includes('message is too long')) {
        throw new StepError({
          name: 'Message too long',
          solution:
            'Shorten the message text to 4096 characters or fewer, especially if variables are used.',
          kind: 'config',
          cause: err,
        })
      } else {
        // return original error since uncaught
        throw err
      }
    case 403:
      throw new StepError({
        name: 'Forbidden',
        solution:
          'Check that the bot is added in the group chat used in your action.',
        kind: 'config',
        cause: err,
      })
    case 429:
      throw new StepError({
        name: 'Rate limit exceeded',
        solution:
          'Too many messages are being sent. Please wait for a minute before retrying and avoid sending more than 20 messages per minute to the same group.',
        kind: 'internal',
        cause: err,
      })
    case 504:
      throw new RetriableError({
        error: 'Timeout error. Telegram may be experiencing issues.',
        delayInMs: 'default',
        delayType: 'step',
      })
    case 401:
      throw new StepError({
        name: 'Invalid bot token',
        solution:
          'Reconnect your Telegram bot with a valid bot token. The token may have been revoked.',
        kind: 'config',
        cause: err,
      })
    default:
      // Axios also sets a code on 4xx responses, so a code means a network error only without a status.
      if (
        err.response.status >= 500 ||
        (err.response.status === undefined && err.code)
      ) {
        throw new StepError({
          name: 'Telegram unavailable',
          solution:
            'Telegram may be experiencing issues. Please try again later.',
          kind: 'third-party',
          cause: err,
        })
      }
      // return original error since uncaught
      throw err
  }
}
