import knex, { Knex } from 'knex'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '../../../knexfile'
import * as aggregates from '../migrations/20261112000000_create-execution-aggregates'
import * as brin from '../migrations/20261112000100_add-executions-updated-at-brin-index'

const FLOW_ID = '11111111-1111-1111-1111-111111111111'

describe('execution aggregate migrations', () => {
  let client: Knex

  beforeAll(async () => {
    client = knex(config as Knex.Config)
  })

  afterAll(async () => {
    await client.destroy()
  })

  it('rolls back and reapplies', async () => {
    await brin.down(client)
    await aggregates.down(client)
    await aggregates.up(client)
    await brin.up(client)

    const { rows } = await client.raw(
      `SELECT c.relname, i.indisvalid, c.reloptions
       FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
       WHERE c.relname = 'executions_updated_at_brin'`,
    )
    expect(rows).toEqual([
      {
        relname: 'executions_updated_at_brin',
        indisvalid: true,
        reloptions: ['autosummarize=on'],
      },
    ])
    expect(await client.schema.hasTable('analytics_watermark')).toBe(true)
  })

  it('upserts a day row with a null status instead of duplicating it', async () => {
    const upsert = (count: number) =>
      client.raw(
        `INSERT INTO execution_daily
           (day, flow_id, test_run, status, duration_bucket, count)
         VALUES ('2026-11-10', ?, true, NULL, 'under_1m', ?)
         ON CONFLICT (flow_id, day, test_run, status, duration_bucket)
         DO UPDATE SET count = excluded.count`,
        [FLOW_ID, count],
      )

    await upsert(1)
    await upsert(2)

    expect(
      await client('execution_daily')
        .where({ flow_id: FLOW_ID })
        .select('count'),
    ).toEqual([{ count: 2 }])
  })

  it('upserts a step row with null keys instead of duplicating it', async () => {
    const upsert = (count: number) =>
      client.raw(
        `INSERT INTO execution_step_daily
           (day, flow_id, test_run, count)
         VALUES ('2026-11-10', ?, false, ?)
         ON CONFLICT
           (flow_id, day, step_id, app_key, action_key, test_run, status, error_kind)
         DO UPDATE SET count = excluded.count`,
        [FLOW_ID, count],
      )

    await upsert(1)
    await upsert(3)

    expect(
      await client('execution_step_daily')
        .where({ flow_id: FLOW_ID })
        .select('count'),
    ).toEqual([{ count: 3 }])
  })

  it('rejects an unknown duration bucket', async () => {
    await expect(
      client('execution_daily').insert({
        day: '2026-11-10',
        flow_id: FLOW_ID,
        test_run: false,
        status: 'success',
        duration_bucket: 'under_2m',
        count: 1,
      }),
    ).rejects.toThrow(/check constraint/)
  })
})
