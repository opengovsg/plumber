/* eslint-disable no-console */
import '../src/config/orm'

import { readdirSync } from 'fs'
import { Knex } from 'knex'
import { join } from 'path'
import { afterEach, beforeEach } from 'vitest'

import config from '../knexfile'
import { client } from '../src/config/database'

type Seed = (client: Knex) => Promise<void>

const seedFns: Seed[] = await Promise.all(
  readdirSync(config.seeds.directory).map(
    async (seedFile) =>
      (
        await import(join(config.seeds.directory, seedFile))
      ).seed,
  ),
)

let cachedTables: string[] | undefined

async function getTruncatableTables(): Promise<string[]> {
  if (!cachedTables) {
    cachedTables = await client('pg_catalog.pg_tables')
      .select('tablename')
      .where('schemaname', 'public')
      .whereNotIn('tablename', ['knex_migrations', 'knex_migrations_lock'])
      .pluck('tablename')
  }
  return cachedTables
}

beforeEach(async () => {
  for (const seed of seedFns) {
    await seed(client)
  }
  console.info(`vite: PostgreSQL seeds run`)
})

afterEach(async () => {
  const tables = await getTruncatableTables()

  if (tables.length > 0) {
    await client.raw(
      `TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(', ')} CASCADE`,
    )
  }
  console.info(`vite: PostgreSQL tables truncated`)
})
