import type { Redis } from 'ioredis'
import { afterEach, describe, expect, it } from 'vitest'

import { createRedisClient } from '@/config/redis'

const clients: Redis[] = []

function makeClient(): Redis {
  const client = createRedisClient() as Redis
  clients.push(client)
  return client
}

afterEach(() => {
  while (clients.length) {
    clients.pop().disconnect()
  }
})

describe('createRedisClient in unit tests', () => {
  it('does not connect on creation', () => {
    expect(makeClient().status).toBe('wait')
  })

  it('gives up instead of scheduling a reconnect', () => {
    expect(makeClient().options.retryStrategy(1)).toBeNull()
  })

  it('swallows connection errors so ioredis does not throw', () => {
    const client = makeClient()

    expect(client.listenerCount('error')).toBeGreaterThan(0)
    expect(() =>
      client.emit('error', new Error('connect ECONNREFUSED')),
    ).not.toThrow()
  })
})
