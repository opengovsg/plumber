import type { Knex } from 'knex'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { flowTransferTable } from '../tables/flow-transfer'
import { connectTestDb } from './helpers/test-db'

const SENDER = '00000000-0000-0000-0000-00000000000a'
const RECIPIENT = '00000000-0000-0000-0000-00000000000b'
const FLOW = '00000000-0000-0000-0000-0000000000f1'

describe('flow_transfer against the migrated schema', () => {
  let db: Knex

  beforeAll(async () => {
    db = connectTestDb()
    await db.raw('TRUNCATE users, flows, flow_transfers CASCADE')
    await db('users').insert([
      { id: SENDER, email: 'sender@tech.gov.sg' },
      { id: RECIPIENT, email: 'recipient@tech.gov.sg' },
    ])
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

  it('reads every transfer with both owners', async () => {
    const rows = await flowTransferTable.fetchRows(db)

    expect(rows).toEqual([
      expect.objectContaining({
        flow_id: FLOW,
        old_owner_user_id: SENDER,
        new_owner_user_id: RECIPIENT,
        status: 'approved',
      }),
    ])
  })
})
