import { UnrecoverableError } from 'bullmq'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { DEFAULT_JOB_OPTIONS } from '@/helpers/default-job-configuration'
import actionQueue from '@/queues/action'
import { worker } from '@/workers/action'

const mocks = vi.hoisted(() => ({
  processAction: vi.fn(),
  exponentialBackoffWithJitter: vi.fn(() => 0),
  handleErrorAndThrow: vi.fn(),
}))

vi.mock('@/helpers/tracer', () => ({
  default: {
    scope: vi.fn(() => ({
      active: vi.fn(),
    })),
    wrap: vi.fn((_, callback) => callback),
  },
}))

vi.mock('@/models/step', () => ({
  default: {
    query: vi.fn(() => ({
      findById: vi.fn(),
    })),
  },
}))

vi.mock('@/models/execution', () => ({
  default: {
    setStatus: vi.fn(),
  },
}))

vi.mock('@/services/action', () => ({
  processAction: mocks.processAction,
}))

vi.mock('@/helpers/actions', () => ({
  handleErrorAndThrow: mocks.handleErrorAndThrow,
}))

vi.mock('@/helpers/backoff', () => ({
  exponentialBackoffWithJitter: mocks.exponentialBackoffWithJitter,
}))

describe('Action worker', () => {
  beforeAll(async () => {
    await worker.waitUntilReady()
  })

  afterAll(async () => {
    await worker.close()
    await actionQueue.close()
  })

  beforeEach(async () => {
    worker.removeAllListeners()
    await actionQueue.obliterate()
    actionQueue.resume()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Automatic retries with default job options', () => {
    it('does not retry successful executions', async () => {
      mocks.processAction.mockResolvedValueOnce({
        executionInfo: {
          executionStep: { isFailed: false, nextStep: null },
        },
      })

      const jobProcessed = new Promise<void>((resolve) => {
        worker.on('completed', async (_) => {
          resolve()
        })
      })
      await actionQueue.add(
        'test-job',
        {
          flowId: 'test-flow-id',
          executionId: 'test-exec-id',
          stepId: 'test-step-id',
        },
        DEFAULT_JOB_OPTIONS,
      )
      await jobProcessed

      expect(mocks.exponentialBackoffWithJitter).not.toBeCalled()
    })

    it('retries retriable executions using our custom backoff strategy', async () => {
      mocks.processAction.mockResolvedValueOnce({
        executionInfo: {
          executionStep: { isFailed: true },
        },
      })
      mocks.handleErrorAndThrow.mockImplementationOnce(() => {
        throw new Error('retriable error')
      })

      const jobProcessed = new Promise<void>((resolve) => {
        worker.on('failed', async (job) => {
          if (job.attemptsMade === DEFAULT_JOB_OPTIONS.attempts) {
            resolve()
          }
        })
      })
      await actionQueue.add(
        'test-job',
        {
          flowId: 'test-flow-id',
          executionId: 'test-exec-id',
          stepId: 'test-step-id',
        },
        DEFAULT_JOB_OPTIONS,
      )
      await jobProcessed

      expect(mocks.exponentialBackoffWithJitter).toBeCalled()
    })

    it('does not retry non-executable executions', async () => {
      mocks.processAction.mockResolvedValueOnce({
        executionInfo: {
          executionStep: { isFailed: true },
        },
      })
      mocks.handleErrorAndThrow.mockImplementationOnce(() => {
        throw new UnrecoverableError('not retriable error')
      })

      const jobProcessed = new Promise<void>((resolve) => {
        worker.on('failed', async (_job, err) => {
          if (err instanceof UnrecoverableError) {
            resolve()
          }
        })
      })
      await actionQueue.add(
        'test-job',
        {
          flowId: 'test-flow-id',
          executionId: 'test-exec-id',
          stepId: 'test-step-id',
        },
        DEFAULT_JOB_OPTIONS,
      )
      await jobProcessed

      // Should not be called, since it was not retried.
      expect(mocks.exponentialBackoffWithJitter).not.toBeCalled()
    })
  })
})
