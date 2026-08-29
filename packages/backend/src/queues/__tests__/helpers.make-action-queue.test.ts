import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as redisConfig from '@/config/redis'
import * as bullmq from '@taskforcesh/bullmq-pro'

import { makeActionQueue } from '../helpers/make-action-queue'

describe('makeActionQueue', () => {
  const queueOn = vi.fn()
  const queueConstructor = vi.fn(function () {
    return { on: queueOn }
  })

  beforeEach(() => {
    queueConstructor.mockClear()
    queueOn.mockClear()

    vi.spyOn(bullmq, 'QueuePro').mockImplementation(
      queueConstructor as never,
    )
    vi.spyOn(redisConfig, 'createRedisClient').mockReturnValue(
      'mock redis client' as never,
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a queue with an configured queue name', () => {
    makeActionQueue({ queueName: '{test-app-queue}' })
    expect(queueConstructor).toHaveBeenCalledWith('{test-app-queue}', {
      connection: 'mock redis client',
    })
  })

  it('supports specifying a redis connection prefix', () => {
    makeActionQueue({
      queueName: 'some-queue',
      redisConnectionPrefix: '{test}',
    })
    expect(queueConstructor).toHaveBeenCalledWith('some-queue', {
      connection: 'mock redis client',
      prefix: `{test}`,
    })
  })
})
