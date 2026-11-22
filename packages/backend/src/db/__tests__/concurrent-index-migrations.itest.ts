import knex, { Knex } from 'knex'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import config from '../../../knexfile'
import * as executionStepsAppKeyKey from '../migrations/20250804015323_add_composite_index_on_execution_steps'
import * as executionsCreatedAtId from '../migrations/20261122120000_add-executions-created-at-id-index'
import * as flowsTestExecutionId from '../migrations/20261122120100_add-flows-test-execution-id-index'

type Migration = {
  up: (client: Knex) => Promise<void>
  down: (client: Knex) => Promise<void>
}

async function getIndex(
  client: Knex,
  indexName: string,
): Promise<{ indisvalid: boolean; oid: number; def: string } | undefined> {
  const { rows } = await client.raw(
    `SELECT i.indisvalid, i.indexrelid::int AS oid, pg_get_indexdef(i.indexrelid) AS def
     FROM pg_index i
     JOIN pg_class c ON c.oid = i.indexrelid
     WHERE c.relname = ?`,
    [indexName],
  )
  return rows[0]
}

// Leaves an invalid index behind, the same way a canceled build does.
async function failConcurrentIndexBuild(
  table: string,
  createIndexSql: string,
): Promise<void> {
  const blocker = knex(config as Knex.Config)
  const builder = knex({
    ...(config as Knex.Config),
    pool: { min: 1, max: 1 },
  })
  try {
    const trx = await blocker.transaction()
    await trx.raw(`LOCK TABLE ${table} IN ROW EXCLUSIVE MODE`)
    await builder.raw("SET lock_timeout = '500ms'")
    await expect(builder.raw(createIndexSql)).rejects.toThrow(/lock timeout/)
    await trx.rollback()
  } finally {
    await builder.destroy()
    await blocker.destroy()
  }
}

describe.each([
  {
    migration: executionStepsAppKeyKey as Migration,
    indexName: 'execution_steps_app_key_key_index',
    table: 'execution_steps',
    columns: '(app_key, key)',
  },
  {
    migration: executionsCreatedAtId as Migration,
    indexName: 'executions_created_at_id_index',
    table: 'executions',
    columns: '(created_at, id)',
  },
  {
    migration: flowsTestExecutionId as Migration,
    indexName: 'flows_test_execution_id_index',
    table: 'flows',
    columns: '(test_execution_id)',
  },
])('$indexName migration', ({ migration, indexName, table, columns }) => {
  let client: Knex

  beforeEach(async () => {
    client = knex(config as Knex.Config)
    await migration.down(client)
  })

  afterEach(async () => {
    await migration.down(client)
    await migration.up(client)
    await client.destroy()
  })

  it('creates a valid index', async () => {
    await migration.up(client)

    expect(await getIndex(client, indexName)).toMatchObject({
      indisvalid: true,
      def: expect.stringContaining(`${table} USING btree ${columns}`),
    })
  })

  it('rebuilds an invalid index left by a failed concurrent build', async () => {
    await failConcurrentIndexBuild(
      table,
      `CREATE INDEX CONCURRENTLY ${indexName} ON ${table} ${columns}`,
    )
    expect((await getIndex(client, indexName))?.indisvalid).toBe(false)

    await migration.up(client)

    expect((await getIndex(client, indexName))?.indisvalid).toBe(true)
  })

  it('keeps an existing valid index', async () => {
    await migration.up(client)
    const existing = await getIndex(client, indexName)

    await migration.up(client)

    expect(await getIndex(client, indexName)).toEqual(existing)
  })
})
