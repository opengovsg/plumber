import { BaseUser } from '@plumber/backend-models'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildAgencyMapping } from '../agency/agency-mapping'
import logger from '../logger'
import {
  addAgency,
  createDimUserTable,
  type DimUserRow,
  toDimUserSqlRow,
} from '../tables/dim-user'

vi.mock('../logger')

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
    last_login_at: null,
    deleted_at: null,
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('addAgency', () => {
  it('returns one row per user with every declared column', () => {
    const rows = addAgency([sqlRow('officer@tech.gov.sg')], mapping)

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

  it('marks every OGP domain as internal', () => {
    const rows = addAgency(
      [
        sqlRow('a@open.gov.sg'),
        sqlRow('b@form.gov.sg'),
        sqlRow('c@tech.gov.sg'),
      ],
      mapping,
    )

    expect(rows.map((row) => row.is_internal)).toEqual([true, true, false])
  })

  it('maps a new subdomain to its parent domain and logs it', () => {
    const [user] = addAgency([sqlRow('officer@new.tech.gov.sg')], mapping)

    expect(user.agency).toBe('tech.gov.sg')
    expect(logger.info).toHaveBeenCalledWith({
      event: 'analytics.agency.fallback',
      domains: [{ domain: 'new.tech.gov.sg -> tech.gov.sg', verifiedUsers: 1 }],
    })
  })

  it('leaves an unknown domain unclassified and logs verified users only', () => {
    const rows = addAgency(
      [
        sqlRow('a@unknown.gov.sg'),
        sqlRow('b@unknown.gov.sg'),
        sqlRow('c@typo.gov.sg', false),
      ],
      mapping,
    )

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
})

describe('toDimUserSqlRow', () => {
  it('reads the model columns and leaves a missing login time null', () => {
    // Built from database columns, so the snake case mappers run as in a query.
    const user = BaseUser.fromDatabaseJson({
      id: 'user-1',
      email: 'officer@tech.gov.sg',
      is_verified: true,
      created_at: signupAt,
      deleted_at: null,
    }) as Parameters<typeof toDimUserSqlRow>[0]

    expect(toDimUserSqlRow(user)).toEqual({
      user_id: 'user-1',
      email: 'officer@tech.gov.sg',
      is_verified: true,
      signup_at: signupAt,
      last_login_at: null,
      deleted_at: null,
    })
  })
})
