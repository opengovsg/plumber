import { readFileSync } from 'node:fs'
import path from 'node:path'

import { DateTime } from 'luxon'
import { z } from 'zod'

import { parseCsv } from '../agency/agency-mapping'
import type { SilverTable } from '../silver-table'

// The backend apps test keeps the registry columns in sync, because importing the registry needs Redis.
// src/tables and dist/tables sit at the same depth.
export const ACTION_CATALOG_PATH = path.resolve(
  __dirname,
  '../../data/action-catalog.csv',
)

const HEADER = [
  'app_key',
  'action_key',
  'name',
  'is_trigger',
  'is_active',
  'resource_parameter',
  'launched_at',
]

const flag = z.enum(['true', 'false']).transform((value) => value === 'true')

const csvRowSchema = z.object({
  app_key: z.string().min(1),
  action_key: z.string().min(1),
  name: z.string().min(1),
  is_trigger: flag,
  is_active: flag,
  // An argument key, or none. The backend apps test checks each key against the registry.
  resource_parameter: z
    .string()
    .min(1)
    .transform((value) => (value === 'none' ? null : value)),
  launched_at: z.string().transform((value, ctx) => {
    if (!value) {
      return null
    }
    const day = DateTime.fromFormat(value, 'yyyy-MM-dd', {
      zone: 'Asia/Singapore',
    })
    if (!day.isValid) {
      ctx.addIssue({ code: 'custom', message: `Invalid date ${value}` })
      return z.NEVER
    }
    return day.toJSDate()
  }),
})

export type ActionCatalogRow = z.output<typeof csvRowSchema> & {
  complexity: string | null
}

/**
 * Parses action-catalog.csv. A blank launch date is not entered yet.
 */
export function parseActionCatalog(text: string): ActionCatalogRow[] {
  const [header, ...lines] = parseCsv(text)
  if (header?.join(',') !== HEADER.join(',')) {
    throw new Error(`action-catalog.csv header must be ${HEADER.join(',')}`)
  }
  const seen = new Set<string>()
  return lines.map((cells, index): ActionCatalogRow => {
    const row = csvRowSchema.parse(
      Object.fromEntries(HEADER.map((name, i) => [name, cells[i] ?? ''])),
    )
    const key = `${row.app_key}.${row.action_key}`
    if (seen.has(key)) {
      throw new Error(`action-catalog.csv line ${index + 2} repeats ${key}`)
    }
    seen.add(key)
    // Complexity marks are a later ticket, PLU-1039.
    return { ...row, complexity: null }
  })
}

export function readActionCatalog(): ActionCatalogRow[] {
  return parseActionCatalog(readFileSync(ACTION_CATALOG_PATH, 'utf8'))
}

/**
 * Maps `app_key.action_key` to the argument that names the step's resource.
 */
export function resourceParameters(
  rows: ActionCatalogRow[],
): Record<string, string> {
  return Object.fromEntries(
    rows.flatMap((row): [string, string][] =>
      row.resource_parameter
        ? [[`${row.app_key}.${row.action_key}`, row.resource_parameter]]
        : [],
    ),
  )
}

export function createActionCatalogTable(
  readCatalog: () => string = () => readFileSync(ACTION_CATALOG_PATH, 'utf8'),
): SilverTable<ActionCatalogRow> {
  return {
    name: 'action_catalog',
    columns: {
      app_key: 'STRING',
      action_key: 'STRING',
      name: 'STRING',
      is_trigger: 'BOOLEAN',
      is_active: 'BOOLEAN',
      resource_parameter: 'STRING',
      launched_at: 'TIMESTAMP',
      complexity: 'STRING',
    },
    fetchRows: async () => parseActionCatalog(readCatalog()),
  }
}

export const actionCatalogTable = createActionCatalogTable()
