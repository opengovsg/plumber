/* oxlint-disable no-console */
import 'dotenv/config'
import { postgres, redis } from '@opengovsg/testcontainers'
import {
  createGlobalSetup,
  type ProvidedContainers,
  TESTCONTAINERS_CONTEXT_KEY,
} from '@opengovsg/testcontainers/vitest'
import knex from 'knex'
import type { TestProject } from 'vitest/node'

import { applyContainerEnv } from './helpers/apply-container-env'
import { REDIS_LOGICAL_DATABASES } from './helpers/integration-constants'
import { runKnexMigrations } from './helpers/run-knex-migrations'

process.env.AWS_REGION = 'ap-southeast-1'
process.env.AWS_ACCESS_KEY_ID = 'awsaccesskeyid'
process.env.AWS_SECRET_ACCESS_KEY = 'awssecretaccesskey'

const setupContainers = createGlobalSetup([
  postgres({
    name: 'postgres',
    image: 'postgres:14.8-alpine',
    environment: {
      POSTGRES_DB: process.env.POSTGRES_DATABASE as string,
      POSTGRES_USER: process.env.POSTGRES_USERNAME as string,
      POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD as string,
    },
  }),
  postgres({
    name: 'tiles-postgres',
    image: 'postgres:16.4-alpine',
    environment: {
      POSTGRES_DB: process.env.TILES_POSTGRES_DATABASE as string,
      POSTGRES_USER: process.env.TILES_POSTGRES_USERNAME as string,
      POSTGRES_PASSWORD: process.env.TILES_POSTGRES_PASSWORD as string,
    },
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

// Every integration project loads this file in its own module graph, but
// globalThis is shared. The projects reuse one set of containers. Only the
// module instance that started them holds the container handles.
type ContainersState = {
  users: number
  ready: Promise<ProvidedContainers>
  stop: () => Promise<void>
}
const store = globalThis as typeof globalThis & {
  __plumberItestContainers?: ContainersState
}

async function startContainers(
  project: TestProject,
  state: ContainersState,
): Promise<ProvidedContainers> {
  state.stop = await setupContainers(project)
  const containers = project.getProvidedContext().testcontainers
  applyContainerEnv(containers)

  const config = (await import('../knexfile')).default
  const client = knex(config)
  await runKnexMigrations(client)
  await client.destroy()
  console.info('PostgreSQL base database migrated')

  return containers
}

export default async (project: TestProject) => {
  if (!store.__plumberItestContainers) {
    const state: ContainersState = {
      users: 0,
      ready: Promise.resolve({}),
      stop: async () => undefined,
    }
    state.ready = startContainers(project, state)
    store.__plumberItestContainers = state
  }
  const state = store.__plumberItestContainers
  state.users += 1
  const containers = await state.ready
  project.provide(TESTCONTAINERS_CONTEXT_KEY, containers)
  applyContainerEnv(containers)

  return async () => {
    state.users -= 1
    if (state.users > 0) {
      return
    }
    store.__plumberItestContainers = undefined
    await state.stop()
  }
}
