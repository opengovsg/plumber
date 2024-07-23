import type { IApp } from '@plumber/types'

import calculatorApp from '@/apps/calculator'
import customApiApp from '@/apps/custom-api'
import delayApp from '@/apps/delay'
import formatterApp from '@/apps/formatter'
import formsgApp from '@/apps/formsg/'
import lettersgApp from '@/apps/lettersg'
import m365ExcelApp from '@/apps/m365-excel'
import paysgApp from '@/apps/paysg'
import postmanApp from '@/apps/postman'
import postmanSmsApp from '@/apps/postman-sms'
import schedulerApp from '@/apps/scheduler'
import slackApp from '@/apps/slack'
import telegramBotApp from '@/apps/telegram-bot'
import tilesApp from '@/apps/tiles'
import toolboxApp from '@/apps/toolbox'
import twilioApp from '@/apps/twilio'
import vaultWorkspaceApp from '@/apps/vault-workspace'
import webhookApp from '@/apps/webhook'
import App from '@/models/app'

import type { QueryResolvers } from '../__generated__/types.generated'

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
  customApiApp.key,
  vaultWorkspaceApp.key,
  twilioApp.key,
]

function sortApps(apps: IApp[]): IApp[] {
  // trade off for increased time complexity but easier to add a new app to the ranking
  return apps.sort((a, b) => {
    const firstPriority = a.triggers
      ? TRIGGER_APPS_RANKING.findIndex((app) => app === a.key)
      : ACTION_APPS_RANKING.findIndex((app) => app === a.key)
    const secondPriority = b.triggers
      ? TRIGGER_APPS_RANKING.findIndex((app) => app === b.key)
      : ACTION_APPS_RANKING.findIndex((app) => app === b.key)

    // sort by newApp flag, followed by priority
    if (a.isNewApp && b.isNewApp) {
      return firstPriority - secondPriority
    }
    if (a.isNewApp) {
      return -1
    }
    if (b.isNewApp) {
      return 1
    }
    return firstPriority - secondPriority
  })
}

const getApps: QueryResolvers['getApps'] = async (_parent, params) => {
  const apps = sortApps(await App.findAll(params.name))
  if (params.onlyWithTriggers) {
    return apps.filter((app) => app.triggers?.length)
  }

  if (params.onlyWithActions) {
    return apps.filter((app) => app.actions?.length)
  }

  return apps
}

export default getApps
