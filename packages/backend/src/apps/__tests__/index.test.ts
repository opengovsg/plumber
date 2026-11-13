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
  // Analytics names app-actions from this file. The first two columns never hold a comma.
  it('lists every trigger and action', () => {
    const catalogPath = join(
      __dirname,
      '../../../../backend-archive/data/action-catalog.csv',
    )
    const listed = new Set(
      fs
        .readFileSync(catalogPath, 'utf8')
        .trim()
        .split('\n')
        .slice(1)
        .map((line) => line.split(',').slice(0, 2).join('.')),
    )
    const registered = Object.values(exportedApps).flatMap((app) =>
      [...(app.triggers ?? []), ...(app.actions ?? [])].map(
        (event) => `${app.key}.${event.key}`,
      ),
    )

    expect(registered.filter((key) => !listed.has(key))).toEqual([])
  })
})
