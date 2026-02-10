/* eslint-disable no-console */
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import knex from 'knex'

let postgresContainer: StartedPostgreSqlContainer

const TILES_POSTGRES_DATABASE = process.env.TILES_POSTGRES_DATABASE as string
const TILES_POSTGRES_USERNAME = process.env.TILES_POSTGRES_USERNAME as string
const TILES_POSTGRES_PASSWORD = process.env.TILES_POSTGRES_PASSWORD as string

export async function setup() {
  postgresContainer = await new PostgreSqlContainer('postgres:16.4-alpine')
    .withDatabase(TILES_POSTGRES_DATABASE)
    .withUsername(TILES_POSTGRES_USERNAME)
    .withPassword(TILES_POSTGRES_PASSWORD)
    .start()

  process.env.TILES_POSTGRES_PORT = postgresContainer.getPort().toString()
  console.info(
    `Tiles PostgreSQL container started at port ${process.env.TILES_POSTGRES_PORT}`,
  )

  // Create per-worker databases for parallel test execution.
  // Tiles tables are created dynamically (no migrations needed).
  const maxForks = parseInt(process.env.VITEST_MAX_FORKS || '4')
  const adminClient = knex({
    client: 'pg',
    connection: {
      host: 'localhost',
      port: postgresContainer.getPort(),
      user: TILES_POSTGRES_USERNAME,
      password: TILES_POSTGRES_PASSWORD,
      database: TILES_POSTGRES_DATABASE,
    },
  })

  for (let i = 1; i <= maxForks; i++) {
    const workerDb = `plumber_tiles_test_${i}`
    await adminClient.raw(`CREATE DATABASE "${workerDb}"`)
    console.info(`Tiles worker DB ${workerDb} created`)
  }

  await adminClient.destroy()
  console.info(`${maxForks} tiles worker databases created`)
}

export async function teardown() {
  if (!postgresContainer) {
    return
  }
  await postgresContainer.stop({ remove: true })
  console.info(`Tiles PostgreSQL container stopped`)
}
