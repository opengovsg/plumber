import type { IApp } from '@plumber/types'

import { Router } from 'express'
import { memoize, pick } from 'lodash'

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

// Memoize the sorted apps data since it's static at runtime.
// This avoids repeated deep cloning and transformation on each request.
const getSortedApps = memoize(async (): Promise<IApp[]> => {
  const apps = await App.findAll()
  return sortApps(apps)
})

/**
 * GET /api/apps
 *
 * Returns list of available apps with their triggers and actions.
 * This endpoint is cached in-memory since apps data is static at runtime.
 */
router.get('/', async (_req, res) => {
  const apps = await getSortedApps()
  res.json({ data: apps.map((app) => pick(app, APP_RESPONSE_FIELDS)) })
})

export default router
