import process from 'process'

import type { Knex } from 'knex'
import knex from 'knex'

import logger from '../helpers/logger'
import { config } from './knex-config'
import { isUnitTestRun } from './unit-test-mode'

export const client: Knex = knex(config)

const CONNECTION_REFUSED = 'ECONNREFUSED'

// Unit tests have no Postgres, so this check can only fail and take the vitest
// worker down with it.
if (!isUnitTestRun) {
  client.raw('SELECT 1').catch((err) => {
    if (err.code === CONNECTION_REFUSED) {
      logger.error(
        'Make sure you have installed PostgreSQL and it is running.',
        err,
      )
      process.exit()
    }
  })
}
