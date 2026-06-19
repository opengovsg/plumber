/**
 * App rankings determine the order apps appear in dropdowns.
 * Triggers and actions have separate rankings.
 *
 * Remember to update these rankings when adding new apps.
 */

import aisayApp from './aisay'
import calculatorApp from './calculator'
import customApiApp from './custom-api'
import databricksApp from './databricks'
import delayApp from './delay'
import formatterApp from './formatter'
import formsgApp from './formsg'
import gathersgApp from './gathersg'
import lettersgApp from './lettersg'
import m365ExcelApp from './m365-excel'
import pairApp from './pair'
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

export const TRIGGER_APPS_RANKING = [
  formsgApp.key,
  schedulerApp.key,
  webhookApp.key,
  gathersgApp.key,
]

export const ACTION_APPS_RANKING = [
  postmanApp.key,
  tilesApp.key,
  m365ExcelApp.key,
  databricksApp.key,
  toolboxApp.key,
  formatterApp.key,
  calculatorApp.key,
  delayApp.key,
  paysgApp.key,
  lettersgApp.key,
  postmanSmsApp.key,
  telegramBotApp.key,
  slackApp.key,
  pairApp.key,
  aisayApp.key,
  gathersgApp.key,
  customApiApp.key,
  vaultWorkspaceApp.key,
  twilioApp.key,
  formsgApp.key,
]
