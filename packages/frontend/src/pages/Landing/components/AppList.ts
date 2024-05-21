import { AppIntegrationProps } from './AppIntegration'

export const CUSTOM_APPS: AppIntegrationProps[] = [
  {
    iconName: 'scheduler',
    name: 'Scheduler',
    description:
      'Trigger an action on a regular basis. You can also select the hour of the day.',
  },
  {
    iconName: 'webhook',
    name: 'Webhook',
    description: 'Send real-time data from internal systems to Plumber.',
  },
  {
    iconName: 'custom-api',
    name: 'Custom API',
    description:
      'Use Custom API to send real-time data from Plumber to an external system and streamline your workflows.',
  },
  {
    iconName: 'delay',
    name: 'Delay',
    description:
      'Put your actions on hold for a specified amount of time before sending data to another app.',
  },
  {
    iconName: 'toolbox',
    name: 'If-then',
    description:
      'Conditional logic for your pipes. If-then lets your apps take different actions based on conditions you choose.',
  },
  {
    iconName: 'tiles',
    name: 'Tiles',
    description:
      'A simple database to view, store and automate your data — all in one place.',
  },
]

export const COMMON_APPS: AppIntegrationProps[] = [
  {
    iconName: 'formsg',
    name: 'FormSG',
    description: 'Build secure government forms in minutes',
  },
  {
    iconName: 'postman',
    name: 'Email by Postman',
    description: 'Reach out to citizens in minutes',
  },
  {
    iconName: 'm365-excel',
    name: 'Excel',
    description: 'Read and store data into your Excel spreadsheets',
  },
  {
    iconName: 'paysg',
    name: 'PaySG',
    description: 'A better way for government to accept payments',
  },
  {
    iconName: 'slack',
    name: 'Slack',
    description: 'A platform for team communication',
  },
  {
    iconName: 'telegram-bot',
    name: 'Telegram',
    description: 'An instant messaging service',
  },
]
