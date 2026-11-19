import type { Knex } from 'knex'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { dbFlowIdResolver } from '../mutation-log/export-mutation-log'
import { connectTestDb } from './helpers/test-db'

const OWNER = 'd1000000-0000-4000-8000-000000000001'
const FLOW = 'd2000000-0000-4000-8000-000000000002'
const LIVE_STEP = 'd3000000-0000-4000-8000-000000000003'
const DELETED_STEP = 'd4000000-0000-4000-8000-000000000004'
const UNKNOWN_STEP = 'd5000000-0000-4000-8000-000000000005'

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

  it('maps step ids to pipe ids, deleted steps included, skipping malformed ids', async () => {
    expect(
      await dbFlowIdResolver(db)([
        LIVE_STEP,
        DELETED_STEP,
        UNKNOWN_STEP,
        'not-a-uuid',
      ]),
    ).toEqual(
      new Map([
        [LIVE_STEP, FLOW],
        [DELETED_STEP, FLOW],
      ]),
    )
  })

  it('skips the query when no id is a UUID', async () => {
    expect(await dbFlowIdResolver({} as never)(['', 'not-a-uuid'])).toEqual(
      new Map(),
    )
  })
})
