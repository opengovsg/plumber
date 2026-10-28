import knex, { Knex } from 'knex'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import config from '../../../knexfile'
import {
  down,
  up,
} from '../migrations/20261028152123_add_steps_app_key_flow_id_index'

const INDEX_NAME = 'steps_app_key_flow_id_index'

async function getIndex(
  client: Knex,
): Promise<{ indisvalid: boolean; oid: number; def: string } | undefined> {
  const { rows } = await client.raw(
    `SELECT i.indisvalid, i.indexrelid::int AS oid,
       pg_get_indexdef(i.indexrelid) AS def
     FROM pg_index i
     JOIN pg_class c ON c.oid = i.indexrelid
     WHERE c.relname = ?`,
    [INDEX_NAME],
  )
  return rows[0]
}

// Leaves an invalid index behind, the same way a canceled build does.
async function failConcurrentIndexBuild(): Promise<void> {
  const blocker = knex(config as Knex.Config)
  const builder = knex({
    ...(config as Knex.Config),
    pool: { min: 1, max: 1 },
  })
  try {
    const trx = await blocker.transaction()
    await trx.raw('LOCK TABLE steps IN ROW EXCLUSIVE MODE')
    await builder.raw("SET lock_timeout = '500ms'")
    await expect(
      builder.raw(
        `CREATE INDEX CONCURRENTLY ${INDEX_NAME} ON steps (app_key, flow_id) WHERE deleted_at IS NULL`,
      ),
    ).rejects.toThrow(/lock timeout/)
    await trx.rollback()
  } finally {
    await builder.destroy()
    await blocker.destroy()
  }
}

describe('add steps app key flow id index migration', () => {
  let client: Knex

  beforeEach(async () => {
    client = knex(config as Knex.Config)
    await down(client)
  })

  afterEach(async () => {
    await down(client)
    await up(client)
    await client.destroy()
  })

  it('creates a valid partial index on non-deleted steps', async () => {
    await up(client)

    const index = await getIndex(client)
    expect(index?.indisvalid).toBe(true)
    expect(index?.def).toContain('(app_key, flow_id)')
    expect(index?.def).toContain('WHERE (deleted_at IS NULL)')
  })

  it('rebuilds an invalid index left by a failed concurrent build', async () => {
    await failConcurrentIndexBuild()
    expect((await getIndex(client))?.indisvalid).toBe(false)

    await up(client)

    expect((await getIndex(client))?.indisvalid).toBe(true)
  })

  it('keeps an existing valid index', async () => {
    await up(client)
    const existing = await getIndex(client)

    await up(client)

    expect(await getIndex(client)).toEqual(existing)
  })
})
