import type { Template } from '@/graphql/__generated__/types.generated'

const GET_LIVE_UPDATES_THROUGH_TELEGRAM_ID =
  '9c964678-8e24-440e-b2fd-b42da4dea4b1'

export const GET_LIVE_UPDATES_THROUGH_TELEGRAM_TEMPLATE: Template = {
  id: GET_LIVE_UPDATES_THROUGH_TELEGRAM_ID,
  name: 'Get live updates through Telegram',
  description:
    'Get updated on your operations quickly when you’re on the ground',
  iconName: 'BiBell',
  // Steps: formsg --> telegram
  steps: [
    {
      position: 1,
      appKey: 'formsg',
      eventKey: 'newSubmission',
      sampleUrl: 'https://form.gov.sg/66c2cfe9659625d2a4d9c037',
    },
    {
      position: 2,
      appKey: 'telegram-bot',
      eventKey: 'sendMessage',
      parameters: {},
    },
  ],
}
