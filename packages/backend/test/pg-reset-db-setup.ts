/* eslint-disable no-console */
import '../src/config/orm'

import { readdirSync } from 'fs'
import knex, { Knex } from 'knex'
import { join } from 'path'
import { afterEach, beforeEach } from 'vitest'

import config from '../knexfile'

beforeEach(async () => {
  const client = knex(config as Knex.Config)

  // manually running seeds for the same reasons
  const seedsToRun = readdirSync(config.seeds.directory)
  for (const seedFile of seedsToRun) {
    const { seed } = await import(join(config.seeds.directory, seedFile))
    await seed(client)
  }
  await client.destroy()
  console.info(`vite: PostgreSQL seeds run`)
})

afterEach(async () => {
  const client = knex(config as Knex.Config)

  // truncate all tables
  const tables = await client('pg_catalog.pg_tables')
    .select('tablename')
    .where('schemaname', 'public')
    .whereNotIn('tablename', ['knex_migrations', 'knex_migrations_lock'])
    .pluck('tablename')
  for (const table of tables) {
    await client.raw(`TRUNCATE TABLE "${table}" CASCADE`)
  }
  console.info(`vite: PostgreSQL tables truncated`)

  // Close the database connection
  await client.destroy()
})
