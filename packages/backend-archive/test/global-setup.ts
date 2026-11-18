import { join } from 'node:path'

import { getMappedPort, postgres } from '@opengovsg/testcontainers'
import { createGlobalSetup } from '@opengovsg/testcontainers/vitest'
import knex from 'knex'
import type { TestProject } from 'vitest/node'

import { TEST_POSTGRES } from '../src/helpers/analytics/__tests__/helpers/test-postgres'

// IMPORTANT: the export queries must run against the app's real schema, so this applies backend's migrations.
// A migration that renames or drops a column the export reads then fails here, before merge.
const BACKEND_MIGRATIONS_DIR = join(
  __dirname,
  '../../backend/src/db/migrations',
)

const setupContainers = createGlobalSetup([
  postgres({
    name: 'postgres',
    image: 'postgres:18.4-alpine',
    environment: {
      POSTGRES_DB: TEST_POSTGRES.database,
      POSTGRES_USER: TEST_POSTGRES.user,
      POSTGRES_PASSWORD: TEST_POSTGRES.password,
    },
    // Postgres opens its port before the restarted server accepts connections.
    wait: {
      type: 'LOG',
      message: 'database system is ready to accept connections',
      times: 2,
    },
  }),
])

export default async (project: TestProject) => {
  const stopContainers = await setupContainers(project)
  const container = project.getProvidedContext().testcontainers.postgres
  const client = knex({
    client: 'pg',
    connection: {
      ...TEST_POSTGRES,
      host: container.host,
      port: getMappedPort(container, 5432),
    },
    migrations: { directory: BACKEND_MIGRATIONS_DIR, loadExtensions: ['.ts'] },
  })
  try {
    const [, pending] = await client.migrate.list()
    for (const { file, directory } of pending) {
      const { up } = await import(join(directory, file))
      await up(client)
    }
  } finally {
    await client.destroy()
  }
  return stopContainers
}
