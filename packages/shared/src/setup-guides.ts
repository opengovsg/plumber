// The editor shows a template step's setup guide only for these app-events, and analytics counts guides shown from the same list.
export const SETUP_GUIDE_APP_EVENTS = [
  'formsg_newSubmission',
  'tiles_createTileRow',
  'tiles_findSingleRow',
  'tiles_updateSingleRow',
  'postman_sendTransactionalEmail',
  'slack_sendMessageToChannel',
  'telegram-bot_sendMessage',
] as const

export type SetupGuideAppEvent = (typeof SETUP_GUIDE_APP_EVENTS)[number]

export function isSetupGuideAppEvent(key: string): key is SetupGuideAppEvent {
  return (SETUP_GUIDE_APP_EVENTS as readonly string[]).includes(key)
}
