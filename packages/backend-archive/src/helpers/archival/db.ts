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
  pool: { min: 0, max: 12 },
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
})
