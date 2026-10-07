import type { Redis } from 'ioredis'
import { afterEach, describe, expect, it } from 'vitest'

import { createRedisClient } from '@/config/redis'

const clients: Redis[] = []

function makeClient(): Redis {
  const client = createRedisClient() as Redis
  clients.push(client)
  return client
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.quit()))
})

describe('createRedisClient in unit tests', () => {
  it('reads and writes without a redis server', async () => {
    const client = makeClient()

    await client.set('unit-test-key', 'ok')

    expect(await client.get('unit-test-key')).toBe('ok')
  })

  it('keeps caller overrides', () => {
    const client = createRedisClient(0, { commandTimeout: 3000 }) as Redis
    clients.push(client)

    expect(client.options.commandTimeout).toBe(3000)
  })
})
