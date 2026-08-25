import { join } from 'path'

import { getWorkerDatabaseIndex } from '@opengovsg/testcontainers/vitest'
import knex, { type Knex } from 'knex'

import { MAX_WORKER_SLOTS, REDIS_DBS_PER_WORKER } from './integration-constants'
import { runKnexMigrations } from './run-knex-migrations'

const MIGRATIONS_DIRECTORY = join(__dirname, '../../src/db/migrations')
const WORKER_ISOLATION_KEY = Symbol.for('plumber.integration.workerIsolation')

type WorkerIsolationState = {
  ready: true
  postgresDatabase: string
  tilesDatabase: string
  redisDbOffset: number
  dynamodbSuffix: string
}

type GlobalWithWorkerIsolation = typeof globalThis & {
  [WORKER_ISOLATION_KEY]?: WorkerIsolationState
}

function postgresAdminConfig(database: string): Knex.Config {
  return {
    client: 'pg',
    connection: {
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT),
      user: process.env.POSTGRES_USERNAME,
      password: process.env.POSTGRES_PASSWORD,
      database,
    },
  }
}

function tilesPostgresAdminConfig(database: string): Knex.Config {
  return {
    client: 'pg',
    connection: {
      host: process.env.TILES_POSTGRES_HOST,
      port: Number(process.env.TILES_POSTGRES_PORT),
      user: process.env.TILES_POSTGRES_USERNAME,
      password: process.env.TILES_POSTGRES_PASSWORD,
      database,
    },
  }
}

async function createDatabaseIfMissing(
  adminClient: Knex,
  databaseName: string,
): Promise<boolean> {
  const existing = await adminClient
    .select('datname')
    .from('pg_database')
    .where('datname', databaseName)
    .first()

  if (existing) {
    return false
  }

  await adminClient.raw('CREATE DATABASE ??', [databaseName])
  return true
}

function applyWorkerEnv(state: WorkerIsolationState): void {
  process.env.POSTGRES_DATABASE = state.postgresDatabase
  process.env.TILES_POSTGRES_DATABASE = state.tilesDatabase
  process.env.REDIS_DB_OFFSET = String(state.redisDbOffset)
  process.env.DYNAMODB_TABLE_SUFFIX = state.dynamodbSuffix
}

function getIsolationSlot(): number {
  const projectIndex = process.env.PLUMBER_ITEST_PROJECT === 'isolated' ? 1 : 0
  return (
    projectIndex * MAX_WORKER_SLOTS + getWorkerDatabaseIndex(MAX_WORKER_SLOTS)
  )
}

async function initializeWorkerIsolation(
  workerSlot: number,
): Promise<WorkerIsolationState> {
  const postgresDatabase = `plumber_test_w${workerSlot}`
  const tilesDatabase = `tiles_test_w${workerSlot}`
  const dynamodbSuffix = `w${workerSlot}`
  const redisDbOffset = workerSlot * REDIS_DBS_PER_WORKER

  const postgresAdmin = knex(
    postgresAdminConfig(process.env.POSTGRES_DATABASE as string),
  )
  let createdPostgresDatabase = false
  try {
    createdPostgresDatabase = await createDatabaseIfMissing(
      postgresAdmin,
      postgresDatabase,
    )
  } finally {
    await postgresAdmin.destroy()
  }

  if (createdPostgresDatabase) {
    const postgresClient = knex({
      ...postgresAdminConfig(postgresDatabase),
      migrations: {
        directory: MIGRATIONS_DIRECTORY,
      },
    })
    try {
      await runKnexMigrations(postgresClient)
    } finally {
      await postgresClient.destroy()
    }
  }

  const tilesAdmin = knex(
    tilesPostgresAdminConfig(process.env.TILES_POSTGRES_DATABASE as string),
  )
  try {
    await createDatabaseIfMissing(tilesAdmin, tilesDatabase)
  } finally {
    await tilesAdmin.destroy()
  }

  const state = {
    ready: true as const,
    postgresDatabase,
    tilesDatabase,
    redisDbOffset,
    dynamodbSuffix,
  }
  // App config snapshots env on first import, so apply isolation before DynamoDB.
  applyWorkerEnv(state)
  const { createDynamoDBTable } = await import('../../src/config/dynamodb')
  await createDynamoDBTable()

  return state
}

export async function ensureWorkerIsolation(): Promise<void> {
  const globalState = globalThis as GlobalWithWorkerIsolation
  const existing = globalState[WORKER_ISOLATION_KEY]

  if (existing?.ready) {
    applyWorkerEnv(existing)
    return
  }

  const state = await initializeWorkerIsolation(getIsolationSlot())
  globalState[WORKER_ISOLATION_KEY] = state
  applyWorkerEnv(state)
}

export { REDIS_DBS_PER_WORKER as workerRedisDbCount }
