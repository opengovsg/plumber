import knex, { type Knex } from 'knex'
import pg from 'pg'

import { archivalConfig } from './config'

// Parse BIGINT columns as JS numbers, not strings (mirrors @/config/database).
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
  pool: { min: 0, max: 5 },
})

// Reader connection. Used for archival's eligibility scan, execution_steps
// fetch, and Phase 5 cleanup-pass fetches. ARCHIVE_POSTGRES_READER_HOST is
// required — startup fails if unset (config.ts enforces this).
//
// Pool sized smaller than the writer — the eligibility query is one-shot per
// batch, and execution_steps fetches happen at most archiveIntraBatchConcurrency
// at once. 10 is plenty of headroom at concurrency=10.
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
  pool: { min: 0, max: 10 },
})
