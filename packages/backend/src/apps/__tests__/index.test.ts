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
  // Analytics cannot import the apps registry, so it reads this file. Run `vitest -u` to rewrite it.
  it('matches the analytics catalog file', async () => {
    const catalog = Object.values(exportedApps)
      .flatMap((app) => [
        ...(app.triggers ?? []).map((trigger) => ({
          app_key: app.key,
          action_key: trigger.key,
          name: trigger.name,
          is_trigger: true,
        })),
        ...(app.actions ?? []).map((action) => ({
          app_key: app.key,
          action_key: action.key,
          name: action.name,
          is_trigger: false,
        })),
      ])
      .sort((a, b) =>
        `${a.app_key}.${a.action_key}`.localeCompare(
          `${b.app_key}.${b.action_key}`,
        ),
      )

    await expect(`${JSON.stringify(catalog, null, 2)}\n`).toMatchFileSnapshot(
      '../../../../backend-analytics/data/action-catalog.json',
    )
  })
})
