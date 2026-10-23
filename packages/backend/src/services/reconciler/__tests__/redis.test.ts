import { EventEmitter } from 'events'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createReconcilerRedisClient } from '../redis'

const mocks = vi.hoisted(() => ({
  createRedisClient: vi.fn(),
  logError: vi.fn(),
}))

vi.mock('@/config/redis', () => ({
  REDIS_DB_INDEX: { JOBS: 0 },
  createRedisClient: mocks.createRedisClient,
}))

vi.mock('@/helpers/logger', () => ({
  default: { error: mocks.logError, warn: vi.fn(), info: vi.fn() },
}))

describe('createReconcilerRedisClient', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('connects to the jobs database', () => {
    mocks.createRedisClient.mockReturnValue(new EventEmitter())

    createReconcilerRedisClient()

    expect(mocks.createRedisClient).toHaveBeenCalledWith(0)
  })

  it('logs connection errors instead of leaving them unhandled', () => {
    const client = new EventEmitter()
    mocks.createRedisClient.mockReturnValue(client)

    createReconcilerRedisClient()
    client.emit('error', new Error('ECONNREFUSED'))

    expect(mocks.logError).toHaveBeenCalledWith(
      'Reconciler Redis connection error',
      expect.objectContaining({ event: 'reconciler-redis-error' }),
    )
  })
})
