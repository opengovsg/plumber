import { afterAll, describe, expect, it, vi } from 'vitest'

import {
  MAIN_ACTION_QUEUE_NAME,
  MAIN_ACTION_QUEUE_REDIS_CONNECTION_PREFIX,
} from '@/queues/action'

const mocks = vi.hoisted(() => ({
  makeActionQueue: vi.fn(),
}))

vi.mock('@/helpers/queues/make-action-queue', () => ({
  makeActionQueue: mocks.makeActionQueue,
}))

vi.mock('@/apps', () => ({
  default: {
    'app-without-queue-1': {},
    'app-without-queue-2': {},
    'app-with-queue-1': {
      queue: {
        stubQueueConfig: 1,
      },
    },
    'app-with-queue-2': {
      queue: {
        stubQueueConfig: 2,
      },
    },
  },
}))

describe('action queues', () => {
  afterAll(() => {
    vi.restoreAllMocks()
  })

  it('creates the main action queue', () => {
    expect(mocks.makeActionQueue).toHaveBeenCalledWith({
      queueName: MAIN_ACTION_QUEUE_NAME,
      redisConnectionPrefix: MAIN_ACTION_QUEUE_REDIS_CONNECTION_PREFIX,
    })
  })

  it('creates a queue for each app that has a queue config', () => {
    expect(mocks.makeActionQueue).toHaveBeenCalledWith({
      queueName: '{app-actions-app-with-queue-1}',
    })
    expect(mocks.makeActionQueue).toHaveBeenCalledWith({
      queueName: '{app-actions-app-with-queue-2}',
    })
  })

  it('does not create action queues for apps that do not have a queue config', () => {
    expect(mocks.makeActionQueue).not.toHaveBeenCalledWith({
      queueName: '{app-actions-app-without-queue-1}',
    })
    expect(mocks.makeActionQueue).not.toHaveBeenCalledWith({
      queueName: '{app-actions-app-without-queue-2}',
    })
  })
})
