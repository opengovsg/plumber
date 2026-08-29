import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { stubAppsRegistry } from '@/test/stub-apps-registry'

const TEST_APPS = {
  'app-without-queue-1': {},
  'app-without-queue-2': {},
  'app-with-queue-1': {
    queue: {
      stubQueueConfig: 1,
      workerType: 'action',
    },
  },
  'app-with-queue-2': {
    queue: {
      stubQueueConfig: 2,
      workerType: 'action',
    },
  },
} as const

function createMockQueue(name: string) {
  return {
    name,
    close: vi.fn(),
    add: vi.fn(),
    getJob: vi.fn(),
  }
}

//
// See integration test (action.itest.ts) for tests related to the worker
// processor.
//

describe('action workers', () => {
  const makeActionWorker = vi.fn()
  let MAIN_ACTION_QUEUE_NAME: string
  let MAIN_ACTION_QUEUE_REDIS_CONNECTION_PREFIX: string
  let restoreAppsRegistry: () => void

  beforeAll(async () => {
    vi.resetModules()

    const makeActionQueueModule =
      await import('@/queues/helpers/make-action-queue.js')
    vi.spyOn(makeActionQueueModule, 'makeActionQueue').mockImplementation(
      ({ queueName }) => createMockQueue(queueName) as never,
    )

    const appsModule = await import('@/apps/index.js')
    restoreAppsRegistry = stubAppsRegistry(appsModule.default, TEST_APPS)

    const makeActionWorkerModule =
      await import('@/workers/helpers/make-action-worker.js')
    vi.spyOn(makeActionWorkerModule, 'makeActionWorker').mockImplementation(
      makeActionWorker as never,
    )

    await import('@/workers/action.js')

    const actionQueueModule = await import('@/queues/action.js')
    MAIN_ACTION_QUEUE_NAME = actionQueueModule.MAIN_ACTION_QUEUE_NAME
    MAIN_ACTION_QUEUE_REDIS_CONNECTION_PREFIX =
      actionQueueModule.MAIN_ACTION_QUEUE_REDIS_CONNECTION_PREFIX
  })

  afterAll(() => {
    restoreAppsRegistry()
    vi.restoreAllMocks()
    process.removeAllListeners('SIGTERM')
  })

  it('creates the worker for the main action queue and makes it undelayable', () => {
    expect(makeActionWorker).toHaveBeenCalledWith({
      appKey: MAIN_ACTION_QUEUE_NAME,
      queueName: MAIN_ACTION_QUEUE_NAME,
      redisConnectionPrefix: MAIN_ACTION_QUEUE_REDIS_CONNECTION_PREFIX,
      queueConfig: {
        isQueueDelayable: false,
        workerType: 'action',
      },
    })
  })

  it('creates a worker for each app that has their own action queue', () => {
    expect(makeActionWorker).toHaveBeenCalledWith({
      appKey: 'app-with-queue-1',
      queueName: '{app-actions-app-with-queue-1}',
      queueConfig: { stubQueueConfig: 1, workerType: 'action' },
    })
    expect(makeActionWorker).toHaveBeenCalledWith({
      appKey: 'app-with-queue-2',
      queueName: '{app-actions-app-with-queue-2}',
      queueConfig: { stubQueueConfig: 2, workerType: 'action' },
    })
  })

  it('does not create action workers for apps that do not have their own queue', () => {
    expect(makeActionWorker).not.toHaveBeenCalledWith(
      expect.objectContaining({
        queueName: '{app-actions-app-without-queue-1}',
      }),
    )
    expect(makeActionWorker).not.toHaveBeenCalledWith(
      expect.objectContaining({
        queueName: '{app-actions-app-without-queue-2}',
      }),
    )
  })
})
