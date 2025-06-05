import { Knex, knex } from 'knex'
import pg from 'pg'

import appConfig from './app'

const tilesPostgresConfig = {
  client: 'pg',
  connection: {
    host: appConfig.tilesPostgres.host,
    port: appConfig.tilesPostgres.port,
    user: appConfig.tilesPostgres.username,
    password: appConfig.tilesPostgres.password,
    database: appConfig.tilesPostgres.database,
    ssl: appConfig.tilesPostgres.enableSsl
      ? {
          rejectUnauthorized: false,
        }
      : false,
  } as pg.ClientConfig,
  pool: { min: 0, max: 20 },
} satisfies Knex.Config

export const tilesClient = knex(tilesPostgresConfig)
