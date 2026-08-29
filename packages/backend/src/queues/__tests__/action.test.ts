import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { stubAppsRegistry } from '@/test/stub-apps-registry'

const makeActionQueue = vi.fn()

const TEST_APPS = {
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
} as const

describe('action queues', () => {
  let actionQueuesByName: Record<string, unknown>
  let appActionQueues: Record<string, unknown>
  let MAIN_ACTION_QUEUE_NAME: string
  let MAIN_ACTION_QUEUE_REDIS_CONNECTION_PREFIX: string
  let restoreAppsRegistry: () => void

  beforeAll(async () => {
    vi.resetModules()

    const makeActionQueueModule =
      await import('@/queues/helpers/make-action-queue')
    vi.spyOn(makeActionQueueModule, 'makeActionQueue').mockImplementation(
      makeActionQueue as never,
    )

    const appsModule = await import('@/apps')
    restoreAppsRegistry = stubAppsRegistry(appsModule.default, TEST_APPS)

    const actionModule = await import('@/queues/action')
    actionQueuesByName = actionModule.actionQueuesByName
    appActionQueues = actionModule.appActionQueues
    MAIN_ACTION_QUEUE_NAME = actionModule.MAIN_ACTION_QUEUE_NAME
    MAIN_ACTION_QUEUE_REDIS_CONNECTION_PREFIX =
      actionModule.MAIN_ACTION_QUEUE_REDIS_CONNECTION_PREFIX
  })

  afterAll(() => {
    restoreAppsRegistry()
    vi.restoreAllMocks()
    process.removeAllListeners('SIGTERM')
  })

  it('creates the main action queue', () => {
    expect(makeActionQueue).toHaveBeenCalledWith({
      queueName: MAIN_ACTION_QUEUE_NAME,
      redisConnectionPrefix: MAIN_ACTION_QUEUE_REDIS_CONNECTION_PREFIX,
    })
  })

  it('creates a queue for each app that has a queue config', () => {
    expect(makeActionQueue).toHaveBeenCalledWith({
      queueName: '{app-actions-app-with-queue-1}',
    })
    expect(makeActionQueue).toHaveBeenCalledWith({
      queueName: '{app-actions-app-with-queue-2}',
    })
  })

  it('does not create action queues for apps that do not have a queue config', () => {
    expect(makeActionQueue).not.toHaveBeenCalledWith({
      queueName: '{app-actions-app-without-queue-1}',
    })
    expect(makeActionQueue).not.toHaveBeenCalledWith({
      queueName: '{app-actions-app-without-queue-2}',
    })
  })

  it('stores app-specific queues in the appActionQueues record', () => {
    expect(Object.keys(appActionQueues)).toMatchObject([
      'app-with-queue-1',
      'app-with-queue-2',
    ])
  })

  it('stores all created queues in actionQueuesByName map', () => {
    expect(Object.keys(actionQueuesByName)).toMatchObject([
      MAIN_ACTION_QUEUE_NAME,
      '{app-actions-app-with-queue-1}',
      '{app-actions-app-with-queue-2}',
    ])
  })
})
