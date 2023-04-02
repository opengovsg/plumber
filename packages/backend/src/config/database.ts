// The following two lines are required to get count values as number.
// More info: https://github.com/knex/knex/issues/387#issuecomment-51554522
import pg from 'pg'
import process from 'process'

pg.types.setTypeParser(20, 'text', parseInt)
import type { Knex } from 'knex'
import knex from 'knex'

import logger from '../helpers/logger'

import appConfig from './app'

export const config = {
  client: 'pg',
  connection: {
    host: appConfig.postgresHost,
    port: appConfig.postgresPort,
    user: appConfig.postgresUsername,
    password: appConfig.postgresPassword,
    database: appConfig.postgresDatabase,
    ssl: appConfig.postgresEnableSsl
      ? {
          rejectUnauthorized: false,
        }
      : false,
  } as pg.ClientConfig,
  pool: { min: 0, max: 20 },
}

export const client: Knex = knex(config)

const CONNECTION_REFUSED = 'ECONNREFUSED'

client.raw('SELECT 1').catch((err) => {
  if (err.code === CONNECTION_REFUSED) {
    logger.error(
      'Make sure you have installed PostgreSQL and it is running.',
      err,
    )
    process.exit()
  }
})
