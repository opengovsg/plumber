/* oxlint-disable no-console */
import 'dotenv/config'
import { postgres, redis } from '@opengovsg/testcontainers'
import { createGlobalSetup } from '@opengovsg/testcontainers/vitest'
import knex from 'knex'
import type { TestProject } from 'vitest/node'

import { applyContainerEnv } from './helpers/apply-container-env'
import { REDIS_LOGICAL_DATABASES } from './helpers/integration-constants'
import { runKnexMigrations } from './helpers/run-knex-migrations'

process.env.AWS_REGION = 'ap-southeast-1'
process.env.AWS_ACCESS_KEY_ID = 'awsaccesskeyid'
process.env.AWS_SECRET_ACCESS_KEY = 'awssecretaccesskey'

// Postgres opens its port before the restarted server accepts connections.
const postgresReady = {
  type: 'LOG' as const,
  message: 'database system is ready to accept connections',
  times: 2,
}

const setupContainers = createGlobalSetup([
  postgres({
    name: 'postgres',
    image: 'postgres:14.8-alpine',
    environment: {
      POSTGRES_DB: process.env.POSTGRES_DATABASE as string,
      POSTGRES_USER: process.env.POSTGRES_USERNAME as string,
      POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD as string,
    },
    wait: postgresReady,
  }),
  postgres({
    name: 'tiles-postgres',
    image: 'postgres:16.4-alpine',
    environment: {
      POSTGRES_DB: process.env.TILES_POSTGRES_DATABASE as string,
      POSTGRES_USER: process.env.TILES_POSTGRES_USERNAME as string,
      POSTGRES_PASSWORD: process.env.TILES_POSTGRES_PASSWORD as string,
    },
    wait: postgresReady,
  }),
  redis({ databases: REDIS_LOGICAL_DATABASES }),
  {
    name: 'dynamodb',
    image: 'amazon/dynamodb-local',
    ports: [8000],
    environment: {
      REGION: 'ap-southeast-1',
    },
    command: ['-jar', 'DynamoDBLocal.jar', '-inMemory', '-sharedDb'],
    wait: { type: 'PORT' },
  },
])

const CONTAINERS_KEY = Symbol.for('plumber.integration.containers')

type SharedContainers = {
  ready: Promise<() => Promise<void>>
  references: number
}

type GlobalWithContainers = typeof globalThis & {
  [CONTAINERS_KEY]?: SharedContainers
}

async function startContainers(project: TestProject) {
  const stopContainers = await setupContainers(project)
  applyContainerEnv(project.getProvidedContext().testcontainers)

  const config = (await import('../knexfile')).default
  const client = knex(config)
  await runKnexMigrations(client)
  await client.destroy()
  console.info('PostgreSQL base database migrated')

  return stopContainers
}

// IMPORTANT: Each vitest project runs this file, but all projects must share
// one set of containers. The first caller starts them and the last teardown
// stops them.
export default async (project: TestProject) => {
  const globalState = globalThis as GlobalWithContainers
  const shared = (globalState[CONTAINERS_KEY] ??= {
    ready: startContainers(project),
    references: 0,
  })
  shared.references += 1
  const stopContainers = await shared.ready

  return async () => {
    shared.references -= 1
    if (shared.references === 0) {
      delete globalState[CONTAINERS_KEY]
      await stopContainers()
    }
  }
}
