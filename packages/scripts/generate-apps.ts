#!/usr/bin/env node

/**
 * Build script to fetch apps and generate a static JSON file
 * Run this during your build process to avoid runtime queries for static data
 *
 * IMPORTANT: This script generates a JSON file that replaces the GraphQL getApps query.
 * When updating app data structure, ensure the normalization below matches what the
 * frontend expects by checking the app usage in the frontend code.
 */

import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

// Load environment variables from backend .env file
dotenv.config({ path: path.join(__dirname, '../backend/.env') })

import type { IApp } from '@plumber/types'

import App from '../backend/src/models/app'
import {
  TRIGGER_APPS_RANKING,
  ACTION_APPS_RANKING,
} from '../backend/src/graphql/queries/get-apps'

// Configuration
const OUTPUT_PATH =
  process.env.OUTPUT_PATH || 'packages/frontend/src/assets/apps.json'

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

// Normalize field to ensure all GraphQL-queried fields exist
function normalizeField(field: any): any {
  return {
    label: field.label ?? null,
    key: field.key ?? null,
    type: field.type ?? null,
    required: field.required ?? null,
    description: field.description ?? null,
    placeholder: field.placeholder ?? null,
    variables: field.variables ?? null,
    variableTypes: field.variableTypes ?? null,
    allowArbitrary: field.allowArbitrary ?? null,
    isSearchable: field.isSearchable ?? null,
    addRowButtonText: field.addRowButtonText ?? null,
    showOptionValue: field.showOptionValue ?? null,
    customStyle: field.customStyle ?? null,
    tooltipText: field.tooltipText ?? null,
    value: field.value ?? null,
    noVariablesMessage: field.noVariablesMessage ?? null,
    options: field.options
      ? field.options.map((option: any) => ({
          ...option,
          description: option.description ?? null,
        }))
      : null,
    source: field.source ?? null,
    hiddenIf: field.hiddenIf
      ? {
          ...field.hiddenIf,
          fieldValue: field.hiddenIf.fieldValue ?? null,
        }
      : null,
    addNewOption: field.addNewOption ?? null,
    clickableLink: field.clickableLink ?? null,
    singleVariableSelection: field.singleVariableSelection ?? null,
    subFields: field.subFields?.map(normalizeField) ?? null,
  }
}

async function fetchApps() {
  try {
    console.log('Fetching apps...')

    // Call App.findAll() directly like the GraphQL query does
    const apps = sortApps(await App.findAll())

    // Normalize apps to ensure all expected fields are present
    // Convert undefined to null for proper JSON serialization
    const normalizedApps = apps.map((app) => {
      // Normalize substeps to ensure all have required fields
      const normalizedTriggers = app.triggers?.map((trigger) => ({
        ...trigger,
        substeps: trigger.substeps?.map((substep) => ({
          key: substep.key ?? null,
          name: substep.name ?? null,
          arguments: substep.arguments?.map(normalizeField) ?? null,
        })),
      }))

      const normalizedActions = app.actions?.map((action) => ({
        ...action,
        isNew: action.isNew ?? null,
        groupsLaterSteps: action.groupsLaterSteps ?? null,
        linkToGuide: action.linkToGuide ?? null,
        setupMessage: action.setupMessage ?? null,
        substeps: action.substeps?.map((substep) => ({
          key: substep.key ?? null,
          name: substep.name ?? null,
          arguments: substep.arguments?.map(normalizeField) ?? null,
        })),
      }))

      return {
        ...app,
        triggers: app.triggers ? normalizedTriggers : null,
        actions: app.actions ? normalizedActions : null,
      }
    })

    return normalizedApps
  } catch (error) {
    console.error('Error fetching apps:', error)
    throw error
  }
}

async function generateAppsJson() {
  try {
    const apps = await fetchApps()

    console.log(`Fetched ${apps.length} apps`)

    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_PATH)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Delete existing file for a clean generation
    if (fs.existsSync(OUTPUT_PATH)) {
      fs.unlinkSync(OUTPUT_PATH)
      console.log(`Deleted existing ${OUTPUT_PATH}`)
    }

    // Write JSON file
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(apps, null, 2), 'utf-8')

    console.log(`✓ Apps written to ${OUTPUT_PATH}`)
    console.log('✓ Generation complete')
    process.exit(0)
  } catch (error) {
    console.error('Failed to generate apps.json:', error)
    process.exit(1)
  }
}

// Run the script
generateAppsJson()
