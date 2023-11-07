import fs from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

import exportedApps from '..'

describe('index.ts', () => {
  it('should export all apps keys that also match their folder names', () => {
    const exportedAppNames = Object.keys(exportedApps)

    // Dynamic apps
    const folderPath = join(__dirname, '..')
    const appFolderNames = fs
      .readdirSync(folderPath)
      .filter((file) => fs.statSync(folderPath + '/' + file).isDirectory())

    // Set comparison
    expect(exportedAppNames.length).toEqual(appFolderNames.length)
    expect(exportedAppNames.sort()).toEqual(appFolderNames.sort())
  })
})
