import type { IApp } from '@plumber/types'

import { Router } from 'express'
import { memoize } from 'lodash'

import { ACTION_APPS_RANKING, TRIGGER_APPS_RANKING } from '@/apps/app-rankings'
import App from '@/models/app'

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

// Pre-compute filtered views for common queries
const getAppsWithTriggers = memoize(async (): Promise<IApp[]> => {
  const apps = await getSortedApps()
  return apps.filter((app) => app.triggers?.length)
})

const getAppsWithActions = memoize(async (): Promise<IApp[]> => {
  const apps = await getSortedApps()
  return apps.filter((app) => app.actions?.length)
})

/**
 * GET /api/apps
 *
 * Returns list of available apps with their triggers and actions.
 * This endpoint is cached in-memory since apps data is static at runtime.
 *
 * Query parameters:
 * - name: Filter apps by name (partial match)
 * - onlyWithTriggers: If 'true', only return apps that have triggers
 * - onlyWithActions: If 'true', only return apps that have actions
 */
router.get('/', async (req, res) => {
  const { name, onlyWithTriggers, onlyWithActions } = req.query

  let apps: IApp[]

  // Use pre-computed filtered views for common queries (no name filter)
  if (!name) {
    if (onlyWithTriggers === 'true') {
      apps = await getAppsWithTriggers()
    } else if (onlyWithActions === 'true') {
      apps = await getAppsWithActions()
    } else {
      apps = await getSortedApps()
    }
  } else {
    // For name-filtered queries, filter from the cached sorted list
    const allApps = await getSortedApps()
    const nameFilter = String(name).toLowerCase()
    apps = allApps.filter((app) => app.key.includes(nameFilter))

    if (onlyWithTriggers === 'true') {
      apps = apps.filter((app) => app.triggers?.length)
    } else if (onlyWithActions === 'true') {
      apps = apps.filter((app) => app.actions?.length)
    }
  }

  // Set cache headers for browser/CDN caching
  // Apps data only changes on deployment, so we can cache aggressively
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60')

  res.json({ data: apps })
})

export default router
