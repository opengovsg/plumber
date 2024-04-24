import '@/workers/action'

import { afterAll, describe, expect, it, vi } from 'vitest'

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

  it('creates the default action worker', () => {
    expect(mocks.makeActionWorker).toHaveBeenCalledWith() // at least one no argument call.
  })

  it('creates a worker for each app that has their own action queue', () => {
    expect(mocks.makeActionWorker).toHaveBeenCalledWith({
      appKey: 'app-with-queue-1',
      config: { stubQueueConfig: 1 },
    })
    expect(mocks.makeActionWorker).toHaveBeenCalledWith({
      appKey: 'app-with-queue-2',
      config: { stubQueueConfig: 2 },
    })
  })

  it('does not create action workers for apps that do not have their own queue', () => {
    expect(mocks.makeActionWorker).not.toHaveBeenCalledWith(
      expect.objectContaining({ appKey: 'app-without-queue-1' }),
    )
    expect(mocks.makeActionWorker).not.toHaveBeenCalledWith(
      expect.objectContaining({ appKey: 'app-without-queue-2' }),
    )
  })
})
