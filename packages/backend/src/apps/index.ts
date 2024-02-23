import { IApp } from '@plumber/types'

import customApiApp from './custom-api'
import delayApp from './delay'
import formsgApp from './formsg'
import lettersgApp from './lettersg'
import m365ExcelApp from './m365-excel'
import paysgApp from './paysg'
import postmanApp from './postman'
import schedulerApp from './scheduler'
import slackApp from './slack'
import telegramBotApp from './telegram-bot'
import tilesApp from './tiles'
import toolboxApp from './toolbox'
import twilioApp from './twilio'
import vaultWorkspaceApp from './vault-workspace'
import webhookApp from './webhook'

const apps: Record<string, IApp> = {
  [customApiApp.key]: customApiApp,
  [delayApp.key]: delayApp,
  [formsgApp.key]: formsgApp,
  [lettersgApp.key]: lettersgApp,
  [m365ExcelApp.key]: m365ExcelApp,
  [paysgApp.key]: paysgApp,
  [postmanApp.key]: postmanApp,
  [schedulerApp.key]: schedulerApp,
  [slackApp.key]: slackApp,
  [telegramBotApp.key]: telegramBotApp,
  [tilesApp.key]: tilesApp,
  [toolboxApp.key]: toolboxApp,
  [twilioApp.key]: twilioApp,
  [vaultWorkspaceApp.key]: vaultWorkspaceApp,
  [webhookApp.key]: webhookApp,
}

export default apps
