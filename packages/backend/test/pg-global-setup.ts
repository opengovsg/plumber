/* eslint-disable no-console */
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import knex from 'knex'
import { join } from 'path'

let postgresContainer: StartedPostgreSqlContainer

const POSTGRES_DATABASE = process.env.POSTGRES_DATABASE as string
const POSTGRES_USERNAME = process.env.POSTGRES_USERNAME as string
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD as string

export async function setup() {
  postgresContainer = await new PostgreSqlContainer()
    .withDatabase(POSTGRES_DATABASE)
    .withUsername(POSTGRES_USERNAME)
    .withPassword(POSTGRES_PASSWORD)
    .start()

  process.env.POSTGRES_PORT = postgresContainer.getPort().toString()
  console.info(
    `PostgreSQL container started at port ${process.env.POSTGRES_PORT}`,
  )

  const config = await import('../knexfile')
  const client = knex(config.default as any)

  // manually running migrations since the programmatic API doesn't work
  // see issue here: https://github.com/knex/knex/issues/5323
  const [_, migrationsToRun] = await client.migrate.list()
  for (const migrationFile of migrationsToRun) {
    const { file, directory } = migrationFile
    const { up } = await import(join(directory, file))
    await up(client)
  }
  console.info(`${migrationsToRun.length} migrations run`)
}

export async function teardown() {
  if (!postgresContainer) {
    return
  }
  await postgresContainer.stop({ remove: true })
  console.info(`PostgreSQL container stopped`)
}
