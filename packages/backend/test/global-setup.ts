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

export default async (project: TestProject) => {
  const stopContainers = await setupContainers(project)
  applyContainerEnv(project.getProvidedContext().testcontainers)

  const config = (await import('../knexfile')).default
  const client = knex(config)
  await runKnexMigrations(client)
  await client.destroy()
  console.info('PostgreSQL base database migrated')

  return stopContainers
}
