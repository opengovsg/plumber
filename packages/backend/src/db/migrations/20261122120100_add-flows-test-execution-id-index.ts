import { Knex } from 'knex'

const INDEX_NAME = 'flows_test_execution_id_index'

/**
 * Keeps archival's test-execution anti-join in executions index order.
 *
 * It also replaces a scan of flows with an index lookup in the foreign key check on each executions delete.
 */
export async function up(knex: Knex): Promise<void> {
  // A canceled or failed CREATE INDEX CONCURRENTLY leaves an invalid index that IF NOT EXISTS would keep.
  const { rows } = await knex.raw<{ rows: { indisvalid: boolean }[] }>(
    `SELECT i.indisvalid
     FROM pg_index i
     JOIN pg_class c ON c.oid = i.indexrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relname = ? AND n.nspname = current_schema()`,
    [INDEX_NAME],
  )
  if (rows.length > 0 && !rows[0].indisvalid) {
    await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS ${INDEX_NAME}`)
  }

  await knex.raw(
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${INDEX_NAME} ON flows (test_execution_id)`,
  )
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS ${INDEX_NAME}`)
}

export const config = { transaction: false }
