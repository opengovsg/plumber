/* oxlint-disable no-console */
import '../src/config/orm'
import { readdirSync } from 'fs'
import { join } from 'path'

import { afterEach, beforeEach } from 'vitest'

import knexfile from '../knexfile'
import { client } from '../src/config/database'

const seedPromises = readdirSync(knexfile.seeds.directory).map(
  (seedFile) => import(join(knexfile.seeds.directory, seedFile)),
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
