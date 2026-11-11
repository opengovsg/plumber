import { readFileSync } from 'node:fs'
import path from 'node:path'

import { DateTime } from 'luxon'
import { z } from 'zod'

import { parseCsv } from '../agency/agency-mapping'
import type { SilverTable } from '../silver-table'

// src/helpers/analytics/tables and dist/helpers/analytics/tables sit at the same depth.
export const ACTION_CATALOG_PATH = path.resolve(
  __dirname,
  '../../../../data/action-catalog.csv',
)

const HEADER = [
  'app_key',
  'action_key',
  'name',
  'is_trigger',
  'launched_at',
  'minutes_saved',
]

const csvRowSchema = z.object({
  app_key: z.string().min(1),
  action_key: z.string().min(1),
  name: z.string().min(1),
  is_trigger: z.enum(['true', 'false']).transform((value) => value === 'true'),
  launched_at: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/)
    .transform((value, ctx) => {
      if (!value) {
        return null
      }
      const day = DateTime.fromISO(value, { zone: 'Asia/Singapore' })
      if (!day.isValid) {
        ctx.addIssue({ code: 'custom', message: `Invalid date ${value}` })
        return z.NEVER
      }
      return day.toJSDate()
    }),
  minutes_saved: z
    .string()
    .regex(/^(\d+)?$/)
    .transform((value) => (value ? Number(value) : null)),
})

export type ActionCatalogRow = z.output<typeof csvRowSchema> & {
  complexity: string | null
}

/**
 * Parses action-catalog.csv. A blank launch date or minutes value means it is not known yet.
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
      throw new Error(
        `action-catalog.csv line ${index + 2} repeats ${row.app_key} ${row.action_key}`,
      )
    }
    seen.add(key)
    // Complexity marks are a later ticket, PLU-1039.
    return { ...row, complexity: null }
  })
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
      complexity: 'STRING',
      minutes_saved: 'INT64',
      launched_at: 'TIMESTAMP',
    },
    fetchRows: async () => parseActionCatalog(readCatalog()),
  }
}

export const actionCatalogTable = createActionCatalogTable()
