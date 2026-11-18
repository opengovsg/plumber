import type { Knex } from 'knex'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildAgencyMapping } from '../agency/agency-mapping'
import { createActionCatalogTable } from '../tables/action-catalog'
import { connectTestDb } from './helpers/test-db'

const INTERNAL = '00000000-0000-0000-0000-0000000000a1'
const EXTERNAL = '00000000-0000-0000-0000-0000000000a2'
const INTERNAL_FLOW = '00000000-0000-0000-0000-0000000000b1'
const EXTERNAL_FLOW = '00000000-0000-0000-0000-0000000000b2'
const EXTERNAL_USE = new Date('2024-02-01T00:00:00.000Z')

const table = createActionCatalogTable({
  readCatalog: () =>
    JSON.stringify([
      {
        app_key: 'tiles',
        action_key: 'createTileRow',
        name: 'Create row',
        is_trigger: false,
        is_active: true,
      },
      {
        app_key: 'formsg',
        action_key: 'newSubmission',
        name: 'New form response',
        is_trigger: true,
        is_active: true,
      },
    ]),
  readLaunchDates: () => 'app_key,action_key,launched_at\n',
  getMapping: () =>
    buildAgencyMapping(
      'canonical,agency_name,category\nopen.gov.sg,Open Government Products,ogp\n',
      'domain,canonical\nopen.gov.sg,open.gov.sg\n',
    ),
})

describe('action_catalog against the migrated schema', () => {
  let db: Knex

  beforeAll(async () => {
    db = connectTestDb()
    await db.raw('TRUNCATE users, flows, flow_transfers, steps CASCADE')
    await db('users').insert([
      { id: INTERNAL, email: 'dev@open.gov.sg' },
      { id: EXTERNAL, email: 'Teacher@MOE.gov.sg' },
    ])
    await db('flows').insert([
      { id: INTERNAL_FLOW, name: 'internal', user_id: INTERNAL },
      {
        id: EXTERNAL_FLOW,
        name: 'external',
        user_id: EXTERNAL,
        deleted_at: new Date(),
      },
    ])
    await db('steps').insert([
      {
        flow_id: INTERNAL_FLOW,
        type: 'trigger',
        app_key: 'formsg',
        key: 'newSubmission',
        position: 1,
        created_at: new Date('2023-06-01'),
      },
      {
        flow_id: INTERNAL_FLOW,
        type: 'action',
        app_key: 'tiles',
        key: 'createTileRow',
        position: 2,
        created_at: new Date('2024-01-01'),
      },
      // A deleted step on a deleted pipe still marks first use.
      {
        flow_id: EXTERNAL_FLOW,
        type: 'action',
        app_key: 'tiles',
        key: 'createTileRow',
        position: 2,
        created_at: EXTERNAL_USE,
        deleted_at: new Date(),
      },
      {
        flow_id: EXTERNAL_FLOW,
        type: 'action',
        app_key: 'tiles',
        key: 'createTileRow',
        position: 3,
        created_at: new Date('2024-05-01'),
      },
    ])
  })

  afterAll(async () => {
    await db.destroy()
  })

  it('dates each app-action from its first use in an external pipe', async () => {
    const rows = await table.fetchRows(db)

    expect(rows).toEqual([
      expect.objectContaining({
        action_key: 'createTileRow',
        launched_at: EXTERNAL_USE,
        launched_at_source: 'first_use',
      }),
      expect.objectContaining({
        action_key: 'newSubmission',
        launched_at: null,
        launched_at_source: null,
      }),
    ])
  })
})
