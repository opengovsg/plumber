import '@/workers/action'

import { afterAll, describe, expect, it, vi } from 'vitest'

import {
  MAIN_ACTION_QUEUE_NAME,
  MAIN_ACTION_QUEUE_REDIS_CONNECTION_PREFIX,
} from '@/queues/action'

//
// See integration test (action.itest.ts) for tests related to the worker
// processor.
//

const mocks = vi.hoisted(() => ({
  makeActionWorker: vi.fn(),
}))

vi.mock('@/helpers/queues/make-action-worker', () => ({
  makeActionWorker: mocks.makeActionWorker,
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

describe('action workers', () => {
  afterAll(() => {
    vi.restoreAllMocks()
  })

  it('creates the worker for the main action queue and makes it unpausable', () => {
    expect(mocks.makeActionWorker).toHaveBeenCalledWith({
      queueName: MAIN_ACTION_QUEUE_NAME,
      redisConnectionPrefix: MAIN_ACTION_QUEUE_REDIS_CONNECTION_PREFIX,
      queueConfig: {
        isQueuePausable: false,
      },
    })
  })

  it('creates a worker for each app that has their own action queue', () => {
    expect(mocks.makeActionWorker).toHaveBeenCalledWith({
      queueName: '{app-actions-app-with-queue-1}',
      queueConfig: { stubQueueConfig: 1 },
    })
    expect(mocks.makeActionWorker).toHaveBeenCalledWith({
      queueName: '{app-actions-app-with-queue-2}',
      queueConfig: { stubQueueConfig: 2 },
    })
  })

  it('does not create action workers for apps that do not have their own queue', () => {
    expect(mocks.makeActionWorker).not.toHaveBeenCalledWith(
      expect.objectContaining({
        queueName: '{app-actions-app-without-queue-1}',
      }),
    )
    expect(mocks.makeActionWorker).not.toHaveBeenCalledWith(
      expect.objectContaining({
        queueName: '{app-actions-app-without-queue-2}',
      }),
    )
  })
})
