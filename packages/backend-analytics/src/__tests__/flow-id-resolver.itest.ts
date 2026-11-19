import type { Knex } from 'knex'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { dbFlowIdResolver } from '../mutation-log/export-mutation-log'
import { connectTestDb } from './helpers/test-db'

const OWNER = '00000000-0000-0000-0000-0000000000d1'
const FLOW = '00000000-0000-0000-0000-0000000000d2'
const LIVE_STEP = '00000000-0000-0000-0000-0000000000d3'
const DELETED_STEP = '00000000-0000-0000-0000-0000000000d4'
const UNKNOWN_STEP = '00000000-0000-0000-0000-0000000000d5'

describe('dbFlowIdResolver against the migrated schema', () => {
  let db: Knex

  beforeAll(async () => {
    db = connectTestDb()
    await db.raw('TRUNCATE users, flows, steps CASCADE')
    await db('users').insert({ id: OWNER, email: 'owner@tech.gov.sg' })
    await db('flows').insert({ id: FLOW, name: 'pipe', user_id: OWNER })
    await db('steps').insert([
      { id: LIVE_STEP, flow_id: FLOW, type: 'action', position: 2 },
      {
        id: DELETED_STEP,
        flow_id: FLOW,
        type: 'action',
        position: 3,
        deleted_at: new Date(),
      },
    ])
  })

  afterAll(async () => {
    await db.destroy()
  })

  it('maps step ids to pipe ids, deleted steps included', async () => {
    expect(
      await dbFlowIdResolver(db)([LIVE_STEP, DELETED_STEP, UNKNOWN_STEP]),
    ).toEqual(
      new Map([
        [LIVE_STEP, FLOW],
        [DELETED_STEP, FLOW],
      ]),
    )
  })

  it('skips the query for no step ids', async () => {
    expect(await dbFlowIdResolver({} as never)([])).toEqual(new Map())
  })
})
