/* eslint-disable no-console */
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import knex, { Knex } from 'knex'
import { join } from 'path'

let postgresContainer: StartedPostgreSqlContainer

const POSTGRES_DATABASE = process.env.POSTGRES_DATABASE as string
const POSTGRES_USERNAME = process.env.POSTGRES_USERNAME as string
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD as string

async function runMigrations(client: Knex) {
  // manually running migrations since the programmatic API doesn't work
  // see issue here: https://github.com/knex/knex/issues/5323
  const [_, migrationsToRun] = await client.migrate.list()
  for (const migrationFile of migrationsToRun) {
    const { file, directory } = migrationFile
    const { up } = await import(join(directory, file))
    await up(client)
  }
  return migrationsToRun.length
}

export async function setup() {
  postgresContainer = await new PostgreSqlContainer('postgres:14.8-alpine')
    .withDatabase(POSTGRES_DATABASE)
    .withUsername(POSTGRES_USERNAME)
    .withPassword(POSTGRES_PASSWORD)
    .start()

  process.env.POSTGRES_PORT = postgresContainer.getPort().toString()
  console.info(
    `PostgreSQL container started at port ${process.env.POSTGRES_PORT}`,
  )

  const config = (await import('../knexfile')).default
  const baseConnection = config.connection as Record<string, unknown>

  function createClient(database: string) {
    return knex({
      ...config,
      connection: {
        ...baseConnection,
        database,
      },
    } as Knex.Config)
  }

  // Create per-worker databases for parallel test execution.
  // Each vitest fork worker connects to its own isolated database.
  const maxForks = parseInt(process.env.VITEST_MAX_FORKS || '4')
  const adminClient = createClient(POSTGRES_DATABASE)

  for (let i = 1; i <= maxForks; i++) {
    const workerDb = `plumber_test_${i}`
    await adminClient.raw(`CREATE DATABASE "${workerDb}"`)

    const workerClient = createClient(workerDb)
    const count = await runMigrations(workerClient)
    console.info(`Worker DB ${workerDb}: ${count} migrations run`)
    await workerClient.destroy()
  }

  await adminClient.destroy()
  console.info(`${maxForks} worker databases created`)
}

export async function teardown() {
  if (!postgresContainer) {
    return
  }
  await postgresContainer.stop({ remove: true })
  console.info(`PostgreSQL container stopped`)
}
