import type { IApp } from '@plumber/types'

import aisayApp from './aisay'
import calculatorApp from './calculator'
import customApiApp from './custom-api'
import delayApp from './delay'
import formatterApp from './formatter'
import formsgApp from './formsg'
import gathersgApp from './gathersg'
import lettersgApp from './lettersg'
import m365ExcelApp from './m365-excel'
import paysgApp from './paysg'
import postmanApp from './postman'
import postmanSmsApp from './postman-sms'
import schedulerApp from './scheduler'
import slackApp from './slack'
import telegramBotApp from './telegram-bot'
import tilesApp from './tiles'
import toolboxApp from './toolbox'
import twilioApp from './twilio'
import vaultWorkspaceApp from './vault-workspace'
import webhookApp from './webhook'

const apps: Record<string, IApp> = {
  [calculatorApp.key]: calculatorApp,
  [customApiApp.key]: customApiApp,
  [delayApp.key]: delayApp,
  [formatterApp.key]: formatterApp,
  [formsgApp.key]: formsgApp,
  [lettersgApp.key]: lettersgApp,
  [m365ExcelApp.key]: m365ExcelApp,
  [paysgApp.key]: paysgApp,
  [postmanApp.key]: postmanApp,
  [postmanSmsApp.key]: postmanSmsApp,
  [schedulerApp.key]: schedulerApp,
  [slackApp.key]: slackApp,
  [telegramBotApp.key]: telegramBotApp,
  [tilesApp.key]: tilesApp,
  [toolboxApp.key]: toolboxApp,
  [twilioApp.key]: twilioApp,
  [vaultWorkspaceApp.key]: vaultWorkspaceApp,
  [webhookApp.key]: webhookApp,
  [aisayApp.key]: aisayApp,
  [gathersgApp.key]: gathersgApp,
}

/**
 * Note: Remember to add the priority of the app here whenever a new app
 * is created, this is to determine which app dropdown option appears first.
 * Note that triggers and actions have separate rankings!
 * Triggers: formsg, scheduler, webhook
 * Actions: email by postman, tiles, m365, toolbox, formatter, calculator, delay,
 * paysg, lettersg, sms by postman, telegram, slack, custom-api, vault, twilio
 */

export const TRIGGER_APPS_RANKING = [
  formsgApp.key,
  schedulerApp.key,
  webhookApp.key,
]
export const ACTION_APPS_RANKING = [
  postmanApp.key,
  tilesApp.key,
  m365ExcelApp.key,
  toolboxApp.key,
  formatterApp.key,
  calculatorApp.key,
  delayApp.key,
  paysgApp.key,
  lettersgApp.key,
  postmanSmsApp.key,
  telegramBotApp.key,
  slackApp.key,
  aisayApp.key,
  gathersgApp.key,
  customApiApp.key,
  vaultWorkspaceApp.key,
  twilioApp.key,
]

export default apps
