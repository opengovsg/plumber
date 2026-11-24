import type { Knex } from 'knex'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { dimUserTable } from '../tables/dim-user'
import { connectTestDb } from './helpers/test-db'

const SENDER = '00000000-0000-0000-0000-00000000000a'
const RECIPIENT = '00000000-0000-0000-0000-00000000000b'
const UNPROVEN = '00000000-0000-0000-0000-00000000000c'
const DELETED = '00000000-0000-0000-0000-00000000000d'
const FLOW = '00000000-0000-0000-0000-0000000000f1'

describe('dim_user against the migrated schema', () => {
  let db: Knex

  beforeAll(async () => {
    db = connectTestDb()
    await db.raw('TRUNCATE users, flows, flow_transfers CASCADE')
    await db('users').insert([
      { id: SENDER, email: 'sender@tech.gov.sg' },
      {
        id: RECIPIENT,
        email: 'recipient@tech.gov.sg',
        last_login_at: new Date('2026-11-01T00:00:00.000Z'),
      },
      { id: UNPROVEN, email: 'typo@example.invalid' },
      {
        id: DELETED,
        email: 'gone@tech.gov.sg',
        deleted_at: new Date('2026-11-02T00:00:00.000Z'),
      },
    ])
    // The sender has no login, so only the pipe they created and handed over proves the account.
    await db('flows').insert({ id: FLOW, name: 'pipe', user_id: RECIPIENT })
    await db('flow_transfers').insert({
      flow_id: FLOW,
      old_owner_id: SENDER,
      new_owner_id: RECIPIENT,
      status: 'approved',
    })
  })

  afterAll(async () => {
    await db.destroy()
  })

  it('reads every user with agency and verification', async () => {
    const rows = await dimUserTable.fetchRows(db)
    const byId = new Map(rows.map((row) => [row.user_id, row]))

    expect(Object.keys(rows[0]).sort()).toEqual(
      Object.keys(dimUserTable.columns).sort(),
    )
    expect(byId.get(SENDER)).toMatchObject({
      agency: 'tech.gov.sg',
      is_verified: true,
    })
    expect(byId.get(RECIPIENT)).toMatchObject({ is_verified: true })
    expect(byId.get(UNPROVEN)).toMatchObject({
      is_verified: false,
      agency_category: 'unclassified',
    })
    expect(byId.get(DELETED)?.deleted_at).toEqual(
      new Date('2026-11-02T00:00:00.000Z'),
    )
  })
})
