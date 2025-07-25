/* eslint-disable no-console */
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'

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
}

export async function teardown() {
  if (!postgresContainer) {
    return
  }
  await postgresContainer.stop({ remove: true })
  console.info(`Tiles PostgreSQL container stopped`)
}
