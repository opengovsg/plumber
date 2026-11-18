import { z } from 'zod'

import {
  type AgencyMapping,
  emailDomain,
  loadAgencyMapping,
  resolveAgency,
  UNCLASSIFIED,
} from '../agency/agency-mapping'
import logger from '../logger'
import type { SilverTable } from '../silver-table'

const dimUserSqlRowSchema = z.object({
  user_id: z.string(),
  email: z.string(),
  is_verified: z.boolean(),
  signup_at: z.date(),
  last_login_at: z.date().nullable(),
  deleted_at: z.date().nullable(),
})

type DimUserSqlRow = z.infer<typeof dimUserSqlRowSchema>

export type DimUserRow = DimUserSqlRow & {
  agency: string | null
  agency_name: string | null
  agency_category: string
  is_internal: boolean
}

// Only facts about the person. Activity milestones are derived in PostHog views from the fact tables.
// is_verified: an OTP request creates the user row before the email is proven, and last_login_at
// only exists from 19 Nov 2024. Creating any pipe, deleted or not, also proves the account.
// IMPORTANT: a transfer rewrites flows.user_id, so the creator is the old owner of the pipe's
// first approved transfer.
const DIM_USER_SQL = `
  SELECT
    u.id AS user_id,
    u.email,
    (u.last_login_at IS NOT NULL OR f.user_id IS NOT NULL) AS is_verified,
    u.created_at AS signup_at,
    u.last_login_at,
    u.deleted_at
  FROM users u
  LEFT JOIN (
    SELECT DISTINCT coalesce(t.old_owner_id, fl.user_id) AS user_id
    FROM flows fl
    LEFT JOIN LATERAL (
      SELECT ft.old_owner_id
      FROM flow_transfers ft
      WHERE ft.flow_id = fl.id AND ft.status = 'approved'
      ORDER BY ft.created_at
      LIMIT 1
    ) t ON true
  ) f ON f.user_id = u.id
  ORDER BY u.created_at
`

type DomainCounts = Map<string, number>

function countDomain(counts: DomainCounts, domain: string): void {
  counts.set(domain, (counts.get(domain) ?? 0) + 1)
}

function sortedCounts(counts: DomainCounts) {
  return [...counts.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([domain, verifiedUsers]) => ({ domain, verifiedUsers }))
}

export function addAgency(
  rows: DimUserSqlRow[],
  mapping: AgencyMapping,
): DimUserRow[] {
  const unclassified: DomainCounts = new Map()
  const fallback: DomainCounts = new Map()

  const result = rows.map((row) => {
    const domain = emailDomain(row.email)
    const resolved = domain ? resolveAgency(mapping, domain) : null
    if (domain && row.is_verified) {
      if (!resolved) {
        countDomain(unclassified, domain)
      } else if (resolved.matchedDomain !== domain) {
        countDomain(fallback, `${domain} -> ${resolved.matchedDomain}`)
      }
    }
    return {
      ...row,
      agency: resolved?.agency.canonical ?? null,
      agency_name: resolved?.agency.agency_name ?? null,
      agency_category: resolved?.agency.category ?? UNCLASSIFIED,
      is_internal: resolved?.agency.category === 'ogp',
    }
  })

  // Unverified accounts are left out, so typo sign-ups do not crowd the list.
  logger.info({
    event: 'analytics.agency.unclassified',
    domains: sortedCounts(unclassified),
  })
  logger.info({
    event: 'analytics.agency.fallback',
    domains: sortedCounts(fallback),
  })
  return result
}

export function createDimUserTable(
  getMapping: () => AgencyMapping = loadAgencyMapping,
): SilverTable<DimUserRow> {
  return {
    name: 'dim_user',
    columns: {
      user_id: 'STRING',
      email: 'STRING',
      agency: 'STRING',
      agency_name: 'STRING',
      agency_category: 'STRING',
      is_internal: 'BOOLEAN',
      is_verified: 'BOOLEAN',
      signup_at: 'TIMESTAMP',
      last_login_at: 'TIMESTAMP',
      deleted_at: 'TIMESTAMP',
    },
    fetchRows: async (db) => {
      const result = await db.raw(DIM_USER_SQL)
      const rows = z.array(dimUserSqlRowSchema).parse(result.rows)
      return addAgency(rows, getMapping())
    },
  }
}

export const dimUserTable = createDimUserTable()
