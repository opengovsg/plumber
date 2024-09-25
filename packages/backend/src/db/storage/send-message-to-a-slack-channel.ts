import type { Template } from '@/graphql/__generated__/types.generated'

const SEND_MESSAGE_TO_A_SLACK_CHANNEL_ID =
  'c88d03f7-862b-45e5-8a51-33e293236bd8'

export const SEND_MESSAGE_TO_A_SLACK_CHANNEL_TEMPLATE: Template = {
  id: SEND_MESSAGE_TO_A_SLACK_CHANNEL_ID,
  name: 'Send message to a Slack channel',
  description: 'Schedule a recurring message to a Slack channel',
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
    },
  ],
}
