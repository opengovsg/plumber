import { getMappedPort } from '@opengovsg/testcontainers'
import type { ProvidedContainers } from '@opengovsg/testcontainers/vitest'

export function applyContainerEnv(containers: ProvidedContainers): void {
  const postgres = containers.postgres
  if (postgres) {
    process.env.POSTGRES_HOST = postgres.host
    process.env.POSTGRES_PORT = String(getMappedPort(postgres, 5432))
  }

  const tilesPostgres = containers['tiles-postgres']
  if (tilesPostgres) {
    process.env.TILES_POSTGRES_HOST = tilesPostgres.host
    process.env.TILES_POSTGRES_PORT = String(getMappedPort(tilesPostgres, 5432))
  }

  const redis = containers.redis
  if (redis) {
    process.env.REDIS_HOST = redis.host
    process.env.REDIS_PORT = String(getMappedPort(redis, 6379))
  }

  const dynamodb = containers.dynamodb
  if (dynamodb) {
    process.env.LOCAL_DYNAMODB_PORT = String(getMappedPort(dynamodb, 8000))
  }
}
