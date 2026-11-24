import { getMappedPort } from '@opengovsg/testcontainers'
import type {} from '@opengovsg/testcontainers/vitest'
import knex, { type Knex } from 'knex'
import { inject } from 'vitest'

import { TEST_POSTGRES } from './test-postgres'

export function connectTestDb(): Knex {
  const container = inject('testcontainers').postgres
  return knex({
    client: 'pg',
    connection: {
      ...TEST_POSTGRES,
      host: container.host,
      port: getMappedPort(container, 5432),
    },
  })
}
