import { Knex } from 'knex'

const INDEX_NAME = 'steps_app_key_flow_id_index'

export async function up(knex: Knex): Promise<void> {
  // IMPORTANT: a canceled or failed CREATE INDEX CONCURRENTLY leaves an invalid
  // index behind. IF NOT EXISTS matches it by name and would skip the rebuild.
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
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${INDEX_NAME} ON steps (app_key, flow_id) WHERE deleted_at IS NULL`,
  )
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS ${INDEX_NAME}`)
}

export const config = { transaction: false }
