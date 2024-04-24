import '@/queues/action'

import { afterAll, describe, expect, it, vi } from 'vitest'

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

  it('creates the default action queue', () => {
    expect(mocks.makeActionQueue).toHaveBeenCalledWith() // at least one no argument call.
  })

  it('creates a queue for each app that has a queue config', () => {
    expect(mocks.makeActionQueue).toHaveBeenCalledWith({
      appKey: 'app-with-queue-1',
    })
    expect(mocks.makeActionQueue).toHaveBeenCalledWith({
      appKey: 'app-with-queue-2',
    })
  })

  it('does not create action queues for apps that do not have a queue config', () => {
    expect(mocks.makeActionQueue).not.toHaveBeenCalledWith({
      appKey: 'app-without-queue-1',
    })
    expect(mocks.makeActionQueue).not.toHaveBeenCalledWith({
      appKey: 'app-without-queue-2',
    })
  })
})
