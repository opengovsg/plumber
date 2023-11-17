import { IRawAction } from '@plumber/types'

import { generateStepError } from '@/helpers/generate-step-error'

import { escapeMarkdown, sanitizeMarkdown } from '../../common/markdown-v1'
import { throwSendMessageError } from '../../common/throw-errors'

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
        throwSendMessageError(err, $.step.position, $.app.name)
      })

    $.setActionItem({
      raw: response.data,
    })
  },
}

export default action
