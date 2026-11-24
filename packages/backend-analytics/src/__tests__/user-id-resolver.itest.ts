import type { Knex } from 'knex'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { dbUserIdResolver } from '../mutation-log/export-mutation-log'
import { connectTestDb } from './helpers/test-db'

const ACTIVE = '00000000-0000-0000-0000-0000000000c1'
const DELETED = '00000000-0000-0000-0000-0000000000c2'

describe('dbUserIdResolver against the migrated schema', () => {
  let db: Knex

  beforeAll(async () => {
    db = connectTestDb()
    await db.raw('TRUNCATE users CASCADE')
    await db('users').insert([
      { id: ACTIVE, email: 'Officer@Agency.gov.sg' },
      { id: DELETED, email: 'left@agency.gov.sg', deleted_at: new Date() },
    ])
  })

  afterAll(async () => {
    await db.destroy()
  })

  it('maps lowercase emails to ids, deleted users included', async () => {
    const resolve = dbUserIdResolver(db)

    expect(
      await resolve([
        'officer@agency.gov.sg',
        'left@agency.gov.sg',
        'nobody@agency.gov.sg',
      ]),
    ).toEqual(
      new Map([
        ['officer@agency.gov.sg', ACTIVE],
        ['left@agency.gov.sg', DELETED],
      ]),
    )
  })

  it('skips the query for no emails', async () => {
    expect(await dbUserIdResolver({} as never)([])).toEqual(new Map())
  })
})
