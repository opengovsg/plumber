/**
 * Build script to generate a static apps.json file
 * Run this before build to avoid runtime GraphQL queries for static app data
 *
 * Usage: npm run generate:apps
 *
 * Note: iconUrl contains {BASE_URL} placeholder which is replaced at runtime
 * by the frontend based on its environment config.
 */

import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

// Load environment variables from backend .env file
dotenv.config({ path: path.join(__dirname, '../backend/.env') })

import type { IApp } from '@plumber/types'

import apps from '../backend/src/apps'
import {
  ACTION_APPS_RANKING,
  TRIGGER_APPS_RANKING,
} from '../backend/src/graphql/queries/get-apps'
import getApp from '../backend/src/helpers/get-app'

const OUTPUT_PATH = 'packages/frontend/src/assets/apps.json'

function sortApps(appList: IApp[]): IApp[] {
  return appList.sort((a, b) => {
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

function fetchApps(): IApp[] {
  const appKeys = Object.keys(apps)
  const allApps = appKeys.map((key) => getApp(key, true))
  return sortApps(allApps)
}

function generateAppsJson() {
  try {
    console.log('Generating apps.json...')

    const appList = fetchApps()
    console.log(`Fetched ${appList.length} apps`)

    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_PATH)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Write JSON file (iconUrl contains {BASE_URL} placeholder)
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(appList, null, 2), 'utf-8')

    console.log(`✓ Apps written to ${OUTPUT_PATH}`)
    process.exit(0)
  } catch (error) {
    console.error('Failed to generate apps.json:', error)
    process.exit(1)
  }
}

generateAppsJson()
