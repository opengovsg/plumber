import fs from 'fs'
import { join } from 'path'

import { describe, expect, it } from 'vitest'

import exportedApps from '@/apps'
import { ACTION_APPS_RANKING, TRIGGER_APPS_RANKING } from '@/apps/app-rankings'

describe('index.ts', () => {
  it('should export all apps keys that also match their folder names', () => {
    const exportedAppNames = Object.keys(exportedApps)

    // Dynamic apps
    const folderPath = join(__dirname, '..')

    const appFolderNames = fs
      .readdirSync(folderPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory() && dirent.name !== '__tests__')
      .map((dirent) => dirent.name)
    // Set comparison
    expect(exportedAppNames.length).toEqual(appFolderNames.length)
    expect(exportedAppNames.sort()).toEqual(appFolderNames.sort())
  })
})

describe('get-apps query', () => {
  it('number of apps in ranking maps should match with the number of apps we have', () => {
    const exportedAppNamesSet = new Set(Object.keys(exportedApps))
    const rankingMapAppsSet = new Set([
      ...TRIGGER_APPS_RANKING,
      ...ACTION_APPS_RANKING,
    ])
    expect(exportedAppNamesSet).toEqual(rankingMapAppsSet)
  })
})

describe('action catalog', () => {
  const catalogPath = join(
    __dirname,
    '../../../../backend-analytics/data/action-catalog.json',
  )

  type CatalogEntry = {
    app_key: string
    action_key: string
    name: string
    is_trigger: boolean
    is_active: boolean
  }

  const catalogKey = (entry: CatalogEntry) =>
    `${entry.app_key}.${entry.action_key}`

  // Analytics cannot import the apps registry, so it reads this file. Run `vitest -u` to rewrite it.
  // Removed app-actions stay as inactive, because past steps and executions still name them.
  it('matches the analytics catalog file', async () => {
    const active: CatalogEntry[] = Object.values(exportedApps).flatMap(
      (app) => [
        ...(app.triggers ?? []).map((trigger) => ({
          app_key: app.key,
          action_key: trigger.key,
          name: trigger.name,
          is_trigger: true,
          is_active: true,
        })),
        ...(app.actions ?? []).map((action) => ({
          app_key: app.key,
          action_key: action.key,
          name: action.name,
          is_trigger: false,
          is_active: true,
        })),
      ],
    )
    const activeKeys = new Set(active.map(catalogKey))
    const committed: CatalogEntry[] = fs.existsSync(catalogPath)
      ? JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
      : []
    const retired = committed
      .filter((entry) => !activeKeys.has(catalogKey(entry)))
      .map((entry) => ({
        app_key: entry.app_key,
        action_key: entry.action_key,
        name: entry.name,
        is_trigger: entry.is_trigger,
        is_active: false,
      }))
    const catalog = [...active, ...retired].sort((a, b) =>
      catalogKey(a).localeCompare(catalogKey(b)),
    )

    await expect(`${JSON.stringify(catalog, null, 2)}\n`).toMatchFileSnapshot(
      catalogPath,
    )
  })
})
