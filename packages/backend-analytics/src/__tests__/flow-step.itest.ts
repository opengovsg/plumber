import type { Knex } from 'knex'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { sgtDayWindow } from '../sgt-day'
import { fetchFlowStepPages, type FlowStepRow } from '../tables/flow-step'
import { connectTestDb } from './helpers/test-db'

const OWNER = '00000000-0000-0000-0000-00000000000a'
const FLOW_A = '00000000-0000-0000-0000-0000000000f1'
const FLOW_B = '00000000-0000-0000-0000-0000000000f2'
const STEP_LAST_SECOND = '00000000-0000-0000-0000-000000000001'
const STEP_DELETED = '00000000-0000-0000-0000-000000000002'
const STEP_NEXT_DAY = '00000000-0000-0000-0000-000000000003'
const STEP_OTHER_FLOW = '00000000-0000-0000-0000-000000000004'

async function collect(
  pages: AsyncIterable<FlowStepRow[]>,
): Promise<FlowStepRow[][]> {
  const result: FlowStepRow[][] = []
  for await (const page of pages) {
    result.push(page)
  }
  return result
}

describe('flow_step against the migrated schema', () => {
  let db: Knex

  beforeAll(async () => {
    db = connectTestDb()
    await db.raw('TRUNCATE users, flows, steps CASCADE')
    await db('users').insert({ id: OWNER, email: 'owner@tech.gov.sg' })
    await db('flows').insert([
      { id: FLOW_A, name: 'a', user_id: OWNER },
      { id: FLOW_B, name: 'b', user_id: OWNER },
    ])
    const step = (id: string, flowId: string, updatedAt: string) => ({
      id,
      flow_id: flowId,
      type: 'action',
      position: 2,
      app_key: 'tiles',
      key: 'createTileRow',
      status: 'completed',
      parameters: { tableId: `table-${id.slice(-1)}` },
      updated_at: new Date(updatedAt),
    })
    // 10 Nov in Singapore runs from 9 Nov 16:00 to 10 Nov 16:00 UTC.
    await db('steps').insert([
      {
        ...step(STEP_LAST_SECOND, FLOW_A, '2026-11-10T15:59:59.000Z'),
        config: { aiBuilderConfig: [{ traceId: 't', tool: 'create_step' }] },
      },
      {
        ...step(STEP_DELETED, FLOW_A, '2026-11-09T16:00:00.000Z'),
        deleted_at: new Date('2026-11-09T16:00:00.000Z'),
      },
      step(STEP_NEXT_DAY, FLOW_A, '2026-11-10T16:00:00.000Z'),
      step(STEP_OTHER_FLOW, FLOW_B, '2026-11-10T08:00:00.000Z'),
    ])
  })

  afterAll(async () => {
    await db.destroy()
  })

  it('reads the steps that changed on a Singapore day, deletes included', async () => {
    const [rows] = await collect(
      fetchFlowStepPages(db, sgtDayWindow('2026-11-10')),
    )

    expect(rows.map((row) => row.step_id)).toEqual([
      STEP_LAST_SECOND,
      STEP_DELETED,
      STEP_OTHER_FLOW,
    ])
    expect(rows[0]).toMatchObject({
      resource_id: 'table-1',
      created_by_ai: true,
      updated_by_ai: false,
    })
    expect(rows[1].deleted_at).not.toBeNull()
  })

  it('reads the resource from the argument the catalog names', async () => {
    const window = sgtDayWindow('2026-11-10')
    const [unmapped] = await collect(fetchFlowStepPages(db, window, 50, {}))
    const [renamed] = await collect(
      fetchFlowStepPages(db, window, 50, { 'tiles.createTileRow': 'rowData' }),
    )

    expect(unmapped.map((row) => row.resource_id)).toEqual([null, null, null])
    expect(renamed.map((row) => row.resource_id)).toEqual([null, null, null])
  })

  it('pages a full copy by pipe, then step, without gaps', async () => {
    const pages = await collect(fetchFlowStepPages(db, null, 2))

    expect(pages.map((page) => page.map((row) => row.step_id))).toEqual([
      [STEP_LAST_SECOND, STEP_DELETED],
      [STEP_NEXT_DAY, STEP_OTHER_FLOW],
    ])
  })
})
