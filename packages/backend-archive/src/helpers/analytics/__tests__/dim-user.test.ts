import type { Knex } from 'knex'
import { afterEach, describe, expect, it, vi } from 'vitest'

import logger from '@/helpers/archival/logger'

import { buildAgencyMapping } from '../agency/agency-mapping'
import { createDimUserTable, type DimUserRow } from '../tables/dim-user'

vi.mock('@/helpers/archival/logger')

const mapping = buildAgencyMapping(
  [
    'canonical,agency_name,category',
    'tech.gov.sg,GovTech,statutory_board',
    'open.gov.sg,Open Government Products,ogp',
  ].join('\n'),
  [
    'domain,canonical',
    'tech.gov.sg,tech.gov.sg',
    'open.gov.sg,open.gov.sg',
    'form.gov.sg,open.gov.sg',
  ].join('\n'),
)

const table = createDimUserTable(() => mapping)

function makeDb(rows: unknown[]) {
  const raw = vi.fn().mockResolvedValue({ rows })
  return { db: { raw } as unknown as Knex, raw }
}

const signupAt = new Date('2026-01-05T02:00:00.000Z')

type SqlRow = Omit<
  DimUserRow,
  'agency' | 'agency_name' | 'agency_category' | 'is_internal'
>

function sqlRow(email: string, isVerified = true): SqlRow {
  return {
    user_id: `user-${email}`,
    email,
    is_verified: isVerified,
    signup_at: signupAt,
    first_created_at: signupAt,
    first_tested_at: null,
    first_published_at: null,
    first_flowed_at: null,
    last_flowed_at: null,
    owned_flowed_pipe_count: null,
    last_login_at: null,
    deleted_at: null,
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('dimUserTable.fetchRows', () => {
  it('returns one row per user with every declared column', async () => {
    const { db } = makeDb([sqlRow('officer@tech.gov.sg')])

    const rows = await table.fetchRows(db)

    expect(Object.keys(rows[0]).sort()).toEqual(
      Object.keys(table.columns).sort(),
    )
    expect(rows[0]).toMatchObject({
      email: 'officer@tech.gov.sg',
      agency: 'tech.gov.sg',
      agency_name: 'GovTech',
      agency_category: 'statutory_board',
      is_internal: false,
      is_verified: true,
    })
  })

  it('marks every OGP domain as internal', async () => {
    const { db } = makeDb([
      sqlRow('a@open.gov.sg'),
      sqlRow('b@form.gov.sg'),
      sqlRow('c@tech.gov.sg'),
    ])

    const rows = await table.fetchRows(db)

    expect(rows.map((row) => row.is_internal)).toEqual([true, true, false])
  })

  it('maps a new subdomain to its parent domain and logs it', async () => {
    const { db } = makeDb([sqlRow('officer@new.tech.gov.sg')])

    const [user] = await table.fetchRows(db)

    expect(user.agency).toBe('tech.gov.sg')
    expect(logger.info).toHaveBeenCalledWith({
      event: 'analytics.agency.fallback',
      domains: [{ domain: 'new.tech.gov.sg -> tech.gov.sg', verifiedUsers: 1 }],
    })
  })

  it('leaves an unknown domain unclassified and logs verified users only', async () => {
    const { db } = makeDb([
      sqlRow('a@unknown.gov.sg'),
      sqlRow('b@unknown.gov.sg'),
      sqlRow('c@typo.gov.sg', false),
    ])

    const rows = await table.fetchRows(db)

    expect(rows[0]).toMatchObject({
      agency: null,
      agency_name: null,
      agency_category: 'unclassified',
      is_internal: false,
    })
    expect(logger.info).toHaveBeenCalledWith({
      event: 'analytics.agency.unclassified',
      domains: [{ domain: 'unknown.gov.sg', verifiedUsers: 2 }],
    })
  })

  it('reads first publish from config and verification from logins or pipes', async () => {
    const { db, raw } = makeDb([sqlRow('officer@tech.gov.sg')])

    await table.fetchRows(db)

    const sql = raw.mock.calls[0][0] as string
    expect(sql).toContain(
      "coalesce((config ->> 'firstPublishedAt')::timestamptz, published_at)",
    )
    expect(sql).toContain(
      '(u.last_login_at IS NOT NULL OR f.user_id IS NOT NULL) AS is_verified',
    )
  })

  it('rejects a row whose shape changed', async () => {
    const { db } = makeDb([{ user_id: 'user-1' }])

    await expect(table.fetchRows(db)).rejects.toThrow()
  })
})
