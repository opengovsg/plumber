import pg from 'pg'
import knex, { type Knex } from 'knex'

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
