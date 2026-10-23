// The following two lines are required to get count values as number.
// More info: https://github.com/knex/knex/issues/387#issuecomment-51554522
import pg from 'pg'

pg.types.setTypeParser(20, 'text', parseInt)
import type { Knex } from 'knex'

// IMPORTANT: import only DB config here. knexfile.ts uses this file, and the
// full app config would fill missing DB vars from .env-example.
import dbConfig from './app/db'

export const config = {
  client: 'pg',
  connection: {
    host: dbConfig.postgresHost,
    port: dbConfig.postgresPort,
    user: dbConfig.postgresUsername,
    password: dbConfig.postgresPassword,
    database: dbConfig.postgresDatabase,
    ssl: dbConfig.postgresEnableSsl
      ? {
          rejectUnauthorized: false,
        }
      : false,
  } satisfies pg.ClientConfig,
  pool: { min: 0, max: 20 },
} satisfies Knex.Config
