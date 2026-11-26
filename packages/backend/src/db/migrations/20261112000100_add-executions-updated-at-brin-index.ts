import { Knex } from 'knex'

const INDEX_NAME = 'executions_updated_at_brin'

/**
 * Lets the nightly aggregation find the executions that finished on a day.
 *
 * IMPORTANT: a B-tree on updated_at would stop HOT updates on every status change. BRIN does not, from Postgres 16.
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

  // A page range left unsummarized is scanned in full. autosummarize summarizes each range once it fills.
  await knex.raw(
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${INDEX_NAME} ON executions USING brin (updated_at) WITH (autosummarize = on)`,
  )
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS ${INDEX_NAME}`)
}

export const config = { transaction: false }
