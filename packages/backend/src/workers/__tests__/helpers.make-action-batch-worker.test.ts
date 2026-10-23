import type { IActionBatchQueue } from '@plumber/types'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { M365_BATCH_SIZE } from '@/config/workers'
import StepError from '@/errors/step'

import { makeActionBatchWorker } from '../helpers/make-action-batch-worker'

const mocks = vi.hoisted(() => {
  const workerOn = vi.fn()

  return {
    // BullMQ worker mocks
    workerConstructor: vi.fn(() => ({
      on: workerOn,
      close: vi.fn(),
    })),
    workerOn,

    // Misc mocks
    processOn: vi.fn(),
    prepareActionExecution: vi.fn(),
    handleFailedJob: vi.fn(),
  }
})

vi.mock('@/queues/action', () => ({
  makeActionJobId: vi.fn(),
}))

vi.mock('@taskforcesh/bullmq-pro', () => ({
  WorkerPro: mocks.workerConstructor,
  UnrecoverableError: class UnrecoverableError extends Error {},
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

vi.mock('@/config/redis', async (importActual) => ({
  ...(await importActual<typeof import('@/config/redis')>()),
  createRedisClient: vi.fn(() => 'mock redis client'),
}))

vi.mock('@/helpers/tracer', () => ({
  default: {
    wrap: vi.fn((_name: string, processor: unknown) => processor),
    scope: () => ({ active: (): null => null }),
  },
}))

vi.mock('@/services/action', async (importActual) => ({
  ...(await importActual<typeof import('@/services/action')>()),
  prepareActionExecution: mocks.prepareActionExecution,
}))

vi.mock('@/workers/helpers/handle-failed-job', () => ({
  handleFailedJob: mocks.handleFailedJob,
}))

vi.mock('@/apps', () => ({
  default: {},
}))

vi.mock('@/helpers/generate-error-email', () => ({
  isErrorEmailAlreadySent: vi.fn(),
  sendErrorEmail: vi.fn(),
}))

const batchConfig: IActionBatchQueue = {
  getGroupConfigForJob: vi.fn(),
  queueRateLimit: {
    max: 1,
    duration: 5000,
  },
}

const workerParams = {
  appKey: 'm365-excel',
  queueName: '{app-actions-m365-excel-batch}',
  batchConfig,
}

describe('makeActionBatchWorker', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a batch worker for the specified queue name', () => {
    makeActionBatchWorker(workerParams)

    expect(mocks.workerConstructor).toHaveBeenCalledWith(
      workerParams.queueName,
      expect.anything(),
      expect.anything(),
    )
  })

  it('configures batch processing with group affinity', () => {
    makeActionBatchWorker(workerParams)

    expect(mocks.workerConstructor).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        batch: expect.objectContaining({
          size: M365_BATCH_SIZE,
          groupAffinity: true,
        }),
      }),
    )
  })

  it('sets group.concurrency equal to batch.size (throughput cap)', () => {
    makeActionBatchWorker(workerParams)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const workerOptions = (mocks.workerConstructor.mock.calls[0] as any[])[2]
    expect(workerOptions.group.concurrency).toBe(M365_BATCH_SIZE)
    expect(workerOptions.group.concurrency).toBe(workerOptions.batch.size)
  })

  it('applies the batch config queue rate limit as the worker limiter', () => {
    makeActionBatchWorker(workerParams)

    expect(mocks.workerConstructor).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        limiter: {
          max: 1,
          duration: 5000,
        },
      }),
    )
  })

  it('registers worker event handlers', () => {
    makeActionBatchWorker(workerParams)

    // registerWorkerEventHandlers attaches listeners via worker.on
    expect(mocks.workerOn).toHaveBeenCalled()
  })

  it('attaches a StepError as the cause of an isolated job failure', async () => {
    const stepError = new StepError({
      name: 'n',
      solution: 's',
      kind: 'config',
    })
    mocks.prepareActionExecution.mockRejectedValue(stepError)
    const batchJob = {
      id: 'job-1',
      data: { flowId: 'flow-1', executionId: 'execution-1', stepId: 'step-1' },
      setAsFailed: vi.fn(),
    }

    makeActionBatchWorker(workerParams)
    const processor = (
      mocks.workerConstructor.mock.calls.at(-1) as unknown as [
        string,
        (job: unknown) => Promise<void>,
      ]
    )[1]
    await processor({ getBatch: () => [batchJob] })

    const [failedJob, failedJobError] = mocks.handleFailedJob.mock.calls[0]
    expect(failedJob).toBe(batchJob)
    expect(failedJobError.cause).toBe(stepError)
    expect(Object.keys(failedJobError)).not.toContain('cause')
  })
})
