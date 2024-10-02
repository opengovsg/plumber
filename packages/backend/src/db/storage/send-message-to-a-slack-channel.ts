import type { ITemplate } from '@plumber/types'

const SEND_MESSAGE_TO_A_SLACK_CHANNEL_ID =
  'c88d03f7-862b-45e5-8a51-33e293236bd8'

export const SEND_MESSAGE_TO_A_SLACK_CHANNEL_TEMPLATE: ITemplate = {
  id: SEND_MESSAGE_TO_A_SLACK_CHANNEL_ID,
  name: 'Send message to a Slack channel',
  description: 'Schedule a recurring message to a Slack channel',
  iconName: 'BiMessageAlt',
  // Steps: formsg --> slack
  steps: [
    {
      position: 1,
      appKey: 'scheduler',
      eventKey: 'everyWeek',
      parameters: { hour: '9', weekday: '3' },
    },
    {
      position: 2,
      appKey: 'slack',
      eventKey: 'sendMessageToChannel',
      parameters: {
        message: 'Update weekly sync document! Sync is at 3pm today at Room A.',
      },
    },
  ],
}
