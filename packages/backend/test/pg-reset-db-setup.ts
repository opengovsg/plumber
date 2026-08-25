/* oxlint-disable no-console */
import { readdirSync } from 'fs'
import { join } from 'path'

import { afterEach, beforeEach } from 'vitest'

import { ensureWorkerIsolation } from './helpers/worker-isolation'

await ensureWorkerIsolation()

const { client } = await import('../src/config/database')
await import('../src/config/orm')

const seedsDirectory = join(__dirname, '../src/db/seeds')
const seedPromises = readdirSync(seedsDirectory).map(
  (seedFile) => import(join(seedsDirectory, seedFile)),
)

beforeEach(async () => {
  const seeds = await Promise.all(seedPromises)
  for (const { seed } of seeds) {
    await seed(client)
  }
  console.info(`vite: PostgreSQL seeds run`)
})

afterEach(async () => {
  const tables: string[] = await client('pg_catalog.pg_tables')
    .select('tablename')
    .where('schemaname', 'public')
    .whereNotIn('tablename', ['knex_migrations', 'knex_migrations_lock'])
    .pluck('tablename')

  if (tables.length > 0) {
    const quoted = tables.map((table) => `"${table}"`).join(', ')
    await client.raw(`TRUNCATE TABLE ${quoted} CASCADE`)
  }
  console.info(`vite: PostgreSQL tables truncated`)
})
