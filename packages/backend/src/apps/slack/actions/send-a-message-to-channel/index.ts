import { IRawAction } from '@plumber/types'

import postMessage from './post-message'

const action: IRawAction = {
  name: 'Send a message to channel',
  key: 'sendMessageToChannel',
  description: 'Sends a message to a specified Slack channel',
  arguments: [
    {
      label: 'Channel',
      key: 'channel',
      type: 'dropdown' as const,
      required: true,
      description: 'Pick a channel to send the message to.',
      variables: false,
      source: {
        type: 'query',
        name: 'getDynamicData',
        arguments: [
          {
            name: 'key',
            value: 'listChannels',
          },
        ],
      },
    },
    {
      label: 'Message text',
      key: 'message',
      type: 'string' as const,
      required: true,
      description: 'The content of your new message.',
      variables: true,
    },
    {
      label: 'Send as a bot?',
      key: 'sendAsBot',
      type: 'dropdown' as const,
      required: false,
      value: false,
      description:
        'If you choose no, this message will appear to come from you. Direct messages are always sent by bots.',
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
    {
      label: 'Bot name',
      key: 'botName',
      type: 'string' as const,
      required: true,
      value: 'Plumber',
      description:
        'Specify the bot name which appears as a bold username above the message inside Slack. Defaults to Plumber.',
      variables: true,
    },
    {
      label: 'Bot icon',
      key: 'botIcon',
      type: 'string' as const,
      required: false,
      description:
        'Either an image url or an emoji available to your team (surrounded by :). For example, https://example.com/icon_256.png or :robot_face:',
      variables: true,
    },
  ],

  async run($) {
    await postMessage($)
  },
}

export default action
