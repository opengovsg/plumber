import { afterEach, describe, expect, it, vi } from 'vitest'

import { makeActionQueue } from '../helpers/make-action-queue'

const mocks = vi.hoisted(() => {
  const queueOn = vi.fn()

  return {
    // BullMQ queue mocks
    queueConstructor: vi.fn(() => ({
      on: queueOn,
    })),
    queueOn,

    // Misc mocks
    processOn: vi.fn(),
  }
})

vi.mock('@taskforcesh/bullmq-pro', () => ({
  QueuePro: mocks.queueConstructor,
}))

vi.mock('process', async () => {
  const process = await vi.importActual<typeof import('process')>('process')
  return {
    default: {
      ...process,
      on: mocks.processOn,
    },
  }
})

vi.mock('@/config/redis', () => ({
  createRedisClient: vi.fn(() => 'mock redis client'),
}))

vi.mock('@/helpers/tracer', () => ({
  default: {
    wrap: vi.fn(() => ({})),
  },
}))

vi.mock('@/apps', () => ({
  default: {},
}))

vi.mock('@/helpers/generate-error-email', () => ({
  isErrorEmailAlreadySent: vi.fn(),
  sendErrorEmail: vi.fn(),
}))

describe('makeActionQueue', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a queue with an configured queue name', () => {
    makeActionQueue({ queueName: '{test-app-queue}' })
    expect(mocks.queueConstructor).toHaveBeenCalledWith('{test-app-queue}', {
      connection: 'mock redis client',
    })
  })

  it('supports specifying a redis connection prefix', () => {
    makeActionQueue({
      queueName: 'some-queue',
      redisConnectionPrefix: '{test}',
    })
    expect(mocks.queueConstructor).toHaveBeenCalledWith('some-queue', {
      connection: 'mock redis client',
      prefix: `{test}`,
    })
  })
})
