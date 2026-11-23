import { Knex } from 'knex'

const INDEX_NAME = 'executions_created_at_id_index'
const EXPECTED_DEFINITION = new RegExp(
  `^CREATE INDEX ${INDEX_NAME} ON (\\w+\\.)?executions USING btree \\(created_at, id\\)$`,
)

/**
 * Lets archival page through executions oldest first.
 *
 * id breaks ties, because executions inserted in the same millisecond share created_at.
 */
export async function up(knex: Knex): Promise<void> {
  // A canceled or failed CREATE INDEX CONCURRENTLY leaves an invalid index that IF NOT EXISTS would keep.
  const { rows } = await knex.raw<{
    rows: { indisvalid: boolean; definition: string }[]
  }>(
    `SELECT i.indisvalid, pg_get_indexdef(i.indexrelid) AS definition
     FROM pg_index i
     JOIN pg_class c ON c.oid = i.indexrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relname = ? AND n.nspname = current_schema()`,
    [INDEX_NAME],
  )
  if (rows.length > 0 && !rows[0].indisvalid) {
    await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS ${INDEX_NAME}`)
  } else if (rows.length > 0 && !EXPECTED_DEFINITION.test(rows[0].definition)) {
    // IF NOT EXISTS matches by name only and would keep the wrong index.
    throw new Error(
      `${INDEX_NAME} exists with another definition: ${rows[0].definition}`,
    )
  }

  await knex.raw(
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${INDEX_NAME} ON executions (created_at, id)`,
  )
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS ${INDEX_NAME}`)
}

export const config = { transaction: false }
