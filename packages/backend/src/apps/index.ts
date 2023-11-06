import { IApp } from '@plumber/types'

import CustomApiApp from './custom-api'
import DelayApp from './delay'
import FormsgApp from './formsg'
import PostmanApp from './postman'
import SchedulerApp from './scheduler'
import SlackApp from './slack'
import TelegramBotApp from './telegram-bot'
import ToolboxApp from './toolbox'
import VaultWorkspaceApp from './vault-workspace'
import WebhookApp from './webhook'

const apps: Record<string, IApp> = {
  [CustomApiApp.key]: CustomApiApp,
  [DelayApp.key]: DelayApp,
  [FormsgApp.key]: FormsgApp,
  [PostmanApp.key]: PostmanApp,
  [SchedulerApp.key]: SchedulerApp,
  [SlackApp.key]: SlackApp,
  [TelegramBotApp.key]: TelegramBotApp,
  [ToolboxApp.key]: ToolboxApp,
  [VaultWorkspaceApp.key]: VaultWorkspaceApp,
  [WebhookApp.key]: WebhookApp,
}

export default apps
