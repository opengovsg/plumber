import { readFileSync } from 'node:fs'
import path from 'node:path'

import type { Knex } from 'knex'
import { DateTime } from 'luxon'
import { z } from 'zod'

import {
  type AgencyMapping,
  emailDomain,
  loadAgencyMapping,
  parseCsv,
  resolveAgency,
} from '../agency/agency-mapping'
import type { SilverTable } from '../silver-table'
import { firstApprovedTransferJoin, flowCreatorSql } from './flow-creator'

// src/tables and dist/tables sit at the same depth.
const DATA_DIR = path.resolve(__dirname, '../../data')

// The backend apps test writes this file, because importing the apps registry needs Redis.
export const ACTION_CATALOG_PATH = path.join(DATA_DIR, 'action-catalog.json')
export const LAUNCH_DATES_PATH = path.join(DATA_DIR, 'action-launch-dates.csv')

const catalogSchema = z.array(
  z.object({
    app_key: z.string().min(1),
    action_key: z.string().min(1),
    name: z.string().min(1),
    is_trigger: z.boolean(),
    is_active: z.boolean(),
  }),
)

type CatalogEntry = z.output<typeof catalogSchema>[number]

export type ActionCatalogRow = CatalogEntry & {
  launched_at: Date | null
  launched_at_source: 'first_use' | 'manual' | null
  complexity: string | null
}

const LAUNCH_HEADER = ['app_key', 'action_key', 'launched_at']

const launchDateSchema = z.object({
  app_key: z.string().min(1),
  action_key: z.string().min(1),
  launched_at: z.string().transform((value, ctx) => {
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

function catalogKey(appKey: string, actionKey: string): string {
  return `${appKey}.${actionKey}`
}

export function parseActionCatalog(text: string): CatalogEntry[] {
  return catalogSchema.parse(JSON.parse(text))
}

/**
 * Parses action-launch-dates.csv. Each date is a Singapore day and must name a catalogued app-action.
 */
export function parseLaunchDates(
  text: string,
  catalog: CatalogEntry[],
): Map<string, Date> {
  const [header, ...lines] = parseCsv(text)
  if (header?.join(',') !== LAUNCH_HEADER.join(',')) {
    throw new Error(
      `action-launch-dates.csv header must be ${LAUNCH_HEADER.join(',')}`,
    )
  }
  const known = new Set(
    catalog.map((entry) => catalogKey(entry.app_key, entry.action_key)),
  )
  const dates = new Map<string, Date>()
  lines.forEach((cells, index) => {
    const row = launchDateSchema.parse(
      Object.fromEntries(
        LAUNCH_HEADER.map((name, i) => [name, cells[i] ?? '']),
      ),
    )
    const key = catalogKey(row.app_key, row.action_key)
    const line = index + 2
    if (!known.has(key)) {
      throw new Error(
        `action-launch-dates.csv line ${line} names unknown ${key}`,
      )
    }
    if (dates.has(key)) {
      throw new Error(`action-launch-dates.csv line ${line} repeats ${key}`)
    }
    dates.set(key, row.launched_at)
  })
  return dates
}

const firstUseRowSchema = z.object({
  app_key: z.string(),
  action_key: z.string(),
  creator_email: z.string().nullable(),
  first_used_at: z.date(),
})

type FirstUseRow = z.infer<typeof firstUseRowSchema>

// Steps hold no author, so the pipe's creator stands in. Deleted steps and pipes still count.
async function fetchFirstUseByCreatorDomain(db: Knex): Promise<FirstUseRow[]> {
  const { rows } = await db.raw(`
    SELECT s.app_key, s.key AS action_key,
      min(u.email) AS creator_email,
      min(s.created_at) AS first_used_at
    FROM steps s
    JOIN flows f ON f.id = s.flow_id
    ${firstApprovedTransferJoin('f')}
    LEFT JOIN users u ON u.id = ${flowCreatorSql('f')}
    WHERE s.app_key IS NOT NULL AND s.key IS NOT NULL
    GROUP BY s.app_key, s.key, lower(split_part(u.email, '@', -1))
  `)
  return z.array(firstUseRowSchema).parse(rows)
}

export function firstExternalUse(
  rows: FirstUseRow[],
  mapping: AgencyMapping,
): Map<string, Date> {
  const firstUse = new Map<string, Date>()
  for (const row of rows) {
    const domain = row.creator_email ? emailDomain(row.creator_email) : null
    const agency = domain ? resolveAgency(mapping, domain) : null
    if (agency?.agency.category === 'ogp') {
      continue
    }
    const key = catalogKey(row.app_key, row.action_key)
    const current = firstUse.get(key)
    if (!current || row.first_used_at < current) {
      firstUse.set(key, row.first_used_at)
    }
  }
  return firstUse
}

export function buildActionCatalog(
  catalog: CatalogEntry[],
  firstUse: Map<string, Date>,
  manual: Map<string, Date>,
): ActionCatalogRow[] {
  return catalog.map((entry) => {
    const key = catalogKey(entry.app_key, entry.action_key)
    const manualDate = manual.get(key)
    const firstUseDate = firstUse.get(key)
    return {
      ...entry,
      launched_at: manualDate ?? firstUseDate ?? null,
      launched_at_source: manualDate
        ? 'manual'
        : firstUseDate
          ? 'first_use'
          : null,
      // Complexity marks are a later ticket, PLU-1039.
      complexity: null,
    }
  })
}

interface ActionCatalogSources {
  readCatalog: () => string
  readLaunchDates: () => string
  getMapping: () => AgencyMapping
}

export function createActionCatalogTable({
  readCatalog = () => readFileSync(ACTION_CATALOG_PATH, 'utf8'),
  readLaunchDates = () => readFileSync(LAUNCH_DATES_PATH, 'utf8'),
  getMapping = loadAgencyMapping,
}: Partial<ActionCatalogSources> = {}): SilverTable<ActionCatalogRow> {
  return {
    name: 'action_catalog',
    columns: {
      app_key: 'STRING',
      action_key: 'STRING',
      name: 'STRING',
      is_trigger: 'BOOLEAN',
      is_active: 'BOOLEAN',
      launched_at: 'TIMESTAMP',
      launched_at_source: 'STRING',
      complexity: 'STRING',
    },
    fetchRows: async (db) => {
      const catalog = parseActionCatalog(readCatalog())
      const manual = parseLaunchDates(readLaunchDates(), catalog)
      const firstUse = firstExternalUse(
        await fetchFirstUseByCreatorDomain(db),
        getMapping(),
      )
      return buildActionCatalog(catalog, firstUse, manual)
    },
  }
}

export const actionCatalogTable = createActionCatalogTable()
