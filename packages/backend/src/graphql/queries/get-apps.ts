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

export const TRIGGER_APPS_RANKING_MAP: Record<string, number> = {
  [formsgApp.key]: 1,
  [schedulerApp.key]: 2,
  [webhookApp.key]: 3,
}

export const ACTION_APPS_RANKING_MAP: Record<string, number> = {
  [postmanApp.key]: 1,
  [tilesApp.key]: 2,
  [m365ExcelApp.key]: 3,
  [toolboxApp.key]: 4,
  [formatterApp.key]: 5,
  [calculatorApp.key]: 6,
  [delayApp.key]: 7,
  [paysgApp.key]: 8,
  [lettersgApp.key]: 9,
  [postmanSmsApp.key]: 10,
  [telegramBotApp.key]: 11,
  [slackApp.key]: 12,
  [customApiApp.key]: 13,
  [vaultWorkspaceApp.key]: 14,
  [twilioApp.key]: 15,
}

function sortApps(apps: IApp[]): IApp[] {
  return apps.sort((a, b) => {
    const firstPriority = a.triggers
      ? TRIGGER_APPS_RANKING_MAP[a.key]
      : ACTION_APPS_RANKING_MAP[a.key]
    const secondPriority = b.triggers
      ? TRIGGER_APPS_RANKING_MAP[b.key]
      : ACTION_APPS_RANKING_MAP[b.key]

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
