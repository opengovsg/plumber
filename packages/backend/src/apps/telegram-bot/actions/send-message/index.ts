import { IRawAction } from '@plumber/types'

import get from 'lodash.get'

import {
  generateHttpStepError,
  generateStepError,
} from '@/helpers/generate-step-error'

import { escapeMarkdown, sanitizeMarkdown } from '../../common/markdown-v1'

const action: IRawAction = {
  name: 'Send message',
  key: 'sendMessage',
  description: 'Sends a message to a chat you specify.',
  arguments: [
    {
      label: 'Chat ID',
      key: 'chatId',
      type: 'dropdown' as const,
      required: true,
      allowArbitrary: true,
      description: 'Chat, group or channel ID. ',
      variables: false,
      source: {
        type: 'query',
        name: 'getDynamicData',
        arguments: [
          {
            name: 'key',
            value: 'getTelegramChatIds',
          },
        ],
      },
    },
    {
      label: 'Message text',
      key: 'text',
      type: 'string' as const,
      required: true,
      description:
        'Text of the message to be sent, 1-4096 characters. Markdown supported.',
      variables: true,
    },
    {
      label: 'Disable notification?',
      key: 'disableNotification',
      type: 'dropdown' as const,
      required: false,
      value: false,
      description:
        'Sends the message silently. Users will receive a notification with no sound.',
      variables: false,
      options: [
        {
          label: 'Yes',
          value: true,
        },
        {
          label: 'No',
          value: false,
        },
      ],
    },
  ],

  preprocessVariable(key: string, value: unknown) {
    if (key === 'text' && typeof value === 'string') {
      return escapeMarkdown(value)
    }
    return value
  },

  async run($) {
    const messageText = ($.step.parameters.text as string).trim()
    if (!messageText) {
      const stepErrorName = 'Empty message text'
      const stepErrorSolution =
        'Click on set up action and check that the message text is not empty, especially if variables are used.'
      throw generateStepError(
        stepErrorName,
        stepErrorSolution,
        $.step.position,
        $.app.name,
      )
    }

    const sanitizedMarkdown = sanitizeMarkdown(messageText)
    const payload = {
      chat_id: $.step.parameters.chatId,
      text: sanitizedMarkdown,
      disable_notification: $.step.parameters.disableNotification,
      parse_mode: 'markdown', // legacy markdown to allow only a small set of modifiers
    }
    const response = await $.http
      .post('/sendMessage', payload)
      .catch((err): never => {
        // different error format for ETIMEDOUT and ECONNRESET

        const status = err.response.status
        let stepErrorSolution = ''
        if (status === 400) {
          // many sub errors caught by telegram for this status
          const errorString = JSON.stringify(
            get(err, 'details.description', ''),
          )
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
        throw generateHttpStepError(
          err,
          stepErrorSolution,
          $.step.position,
          $.app.name,
        )
      })
    console.log({ response: response.data.result })

    $.setActionItem({
      raw: response.data,
    })
  },
}

export default action
