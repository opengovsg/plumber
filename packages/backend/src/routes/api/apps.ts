import type { IApp } from '@plumber/types'

import { Router } from 'express'
import { pick } from 'lodash'

import { ACTION_APPS_RANKING, TRIGGER_APPS_RANKING } from '@/apps/app-rankings'
import App from '@/models/app'

// Fields returned to the frontend — update this to add/remove fields
const APP_RESPONSE_FIELDS = [
  'name',
  'key',
  'iconUrl',
  'docUrl',
  'authDocUrl',
  'primaryColor',
  'connectionCount',
  'description',
  'isNewApp',
  'category',
  'setupMessage',
  'demoVideoDetails',
  'auth',
  'triggers',
  'actions',
] as const satisfies ReadonlyArray<keyof IApp>
type AppResponse = Pick<IApp, (typeof APP_RESPONSE_FIELDS)[number]>

const router = Router()

function sortApps(apps: IApp[]): IApp[] {
  return apps.sort((a, b) => {
    const firstPriority = a.triggers
      ? TRIGGER_APPS_RANKING.findIndex((app) => app === a.key)
      : ACTION_APPS_RANKING.findIndex((app) => app === a.key)
    const secondPriority = b.triggers
      ? TRIGGER_APPS_RANKING.findIndex((app) => app === b.key)
      : ACTION_APPS_RANKING.findIndex((app) => app === b.key)

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

let cachedAppsResponse: AppResponse[] | null = null

async function getAppsResponse(): Promise<AppResponse[]> {
  if (cachedAppsResponse) {
    return cachedAppsResponse
  }
  const apps = await App.findAll()
  cachedAppsResponse = sortApps(apps).map((app) =>
    pick(app, APP_RESPONSE_FIELDS),
  )
  return cachedAppsResponse
}

/**
 * GET /api/apps
 *
 * Returns list of available apps with their triggers and actions.
 * This endpoint is cached in-memory since apps data is static at runtime.
 */
router.get('/', async (_req, res) => {
  const data = await getAppsResponse()
  res.json({ data })
})

export default router
