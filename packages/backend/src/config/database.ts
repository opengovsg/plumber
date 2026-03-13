// The following two lines are required to get count values as number.
// More info: https://github.com/knex/knex/issues/387#issuecomment-51554522
import pg from 'pg'
import process from 'process'

pg.types.setTypeParser(20, 'text', parseInt)
import type { Knex } from 'knex'
import knex from 'knex'

import logger from '../helpers/logger'
import { markQueryStart, trackQuery } from '../helpers/request-context'

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
  } satisfies pg.ClientConfig,
  pool: { min: 0, max: 20 },
} satisfies Knex.Config

export const client: Knex = knex(config)

client.on('query', (query) => {
  markQueryStart(query.__knexQueryUid)
})

client.on('query-response', (_response, query) => {
  trackQuery(query.__knexQueryUid, query.sql)
})

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
