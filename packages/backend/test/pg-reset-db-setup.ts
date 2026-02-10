/* eslint-disable no-console */
import '../src/config/orm'

import { readdirSync } from 'fs'
import knex, { Knex } from 'knex'
import { join } from 'path'
import { afterEach, beforeEach } from 'vitest'

import config from '../knexfile'

// Reuse a single client per worker process instead of creating/destroying per hook.
// POSTGRES_DATABASE is already set to the worker-specific DB by worker-db-setup.ts.
const resetClient = knex(config as Knex.Config)

// Cache the table list since it doesn't change between tests.
let tableList: string[] | null = null

beforeEach(async () => {
  // manually running seeds for the same reasons
  const seedsToRun = readdirSync(config.seeds.directory)
  for (const seedFile of seedsToRun) {
    const { seed } = await import(join(config.seeds.directory, seedFile))
    await seed(resetClient)
  }
  console.info(`vite: PostgreSQL seeds run`)
})

afterEach(async () => {
  // truncate all tables
  if (!tableList) {
    tableList = await resetClient('pg_catalog.pg_tables')
      .select('tablename')
      .where('schemaname', 'public')
      .whereNotIn('tablename', ['knex_migrations', 'knex_migrations_lock'])
      .pluck('tablename')
  }
  if (tableList.length > 0) {
    const quoted = tableList.map((t) => `"${t}"`).join(', ')
    await resetClient.raw(`TRUNCATE TABLE ${quoted} CASCADE`)
  }
  console.info(`vite: PostgreSQL tables truncated`)
})
