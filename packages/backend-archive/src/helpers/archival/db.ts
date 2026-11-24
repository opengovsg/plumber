import knex, { type Knex } from 'knex'
import pg from 'pg'

import { archivalConfig } from './config'

// Parse BIGINT columns as JS numbers, not strings.
// Mirrors backend's config/knex-config.ts.
pg.types.setTypeParser(20, 'text', parseInt)

export const archivalDb: Knex = knex({
  client: 'pg',
  connection: {
    host: archivalConfig.postgresHost,
    port: archivalConfig.postgresPort,
    user: archivalConfig.postgresUsername,
    password: archivalConfig.postgresPassword,
    database: archivalConfig.postgresDatabase,
    ssl: archivalConfig.postgresEnableSsl
      ? { rejectUnauthorized: false }
      : false,
  } satisfies pg.ClientConfig,
  pool: { min: 0, max: 12 },
  // IMPORTANT: knex otherwise writes bound values, such as user emails, into a failed query's message.
  compileSqlOnError: false,
})

// Reader connection. Used for archival's eligibility scan, execution_steps
// fetch, and Phase 5 cleanup-pass fetches. ARCHIVE_POSTGRES_READER_HOST is
// required — startup fails if unset (config.ts enforces this).
export const archivalDbReader: Knex = knex({
  client: 'pg',
  connection: {
    host: archivalConfig.postgresReaderHost,
    port: archivalConfig.postgresPort,
    user: archivalConfig.postgresUsername,
    password: archivalConfig.postgresPassword,
    database: archivalConfig.postgresDatabase,
    ssl: archivalConfig.postgresEnableSsl
      ? { rejectUnauthorized: false }
      : false,
  } satisfies pg.ClientConfig,
  pool: { min: 0, max: 14 },
  compileSqlOnError: false,
})

/**
 * Rewrites a failed query's PostgreSQL error to hold only the operation, SQLSTATE and schema identifiers.
 *
 * IMPORTANT: PostgreSQL echoes the rejected value in its message and detail, such as an invalid UUID.
 */
function redactDatabaseError(err: unknown, query: { method?: string }): void {
  if (!(err instanceof pg.DatabaseError)) {
    return
  }
  const identifiers = {
    routine: err.routine,
    table: err.table,
    column: err.column,
    constraint: err.constraint,
  }
  const context = Object.entries(identifiers)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ')
  err.message = `PostgreSQL ${query.method ?? 'query'} failed with SQLSTATE ${err.code}${context ? ` (${context})` : ''}`
  err.stack = `${err.name}: ${err.message}`
  err.detail = undefined
  err.hint = undefined
  err.where = undefined
  err.internalQuery = undefined
}

// knex emits this before it rejects the query, so the rewrite reaches every caller.
archivalDb.on('query-error', redactDatabaseError)
archivalDbReader.on('query-error', redactDatabaseError)
