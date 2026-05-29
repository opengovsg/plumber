import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  // Mutable holder for the step key the mocked Step returns, so each test can
  // steer routing without re-mocking the module.
  stepKey: { value: 'createTableRow' },
}))

// Capture every queue created at module load with an `add` spy keyed by name.
vi.mock('@/queues/helpers/make-action-queue', () => ({
  makeActionQueue: vi.fn(({ queueName }: { queueName: string }) => ({
    name: queueName,
    add: vi.fn(async (name: string, data: unknown, opts: unknown) => ({
      id: '1',
      queueName,
      name,
      data,
      opts,
    })),
    // The action.ts SIGTERM handler calls q.close() on teardown.
    close: vi.fn(async () => {}),
  })),
}))

// One app with a batch config (so it gets a dedicated batch queue) and one
// without (so it only ever uses its regular queue).
vi.mock('@/apps', () => ({
  default: {
    'batch-app': {
      queue: {
        getGroupConfigForJob: async () => ({ id: 'file-grp' }),
        batch: {
          size: 20,
          groupAffinity: true,
          actionKeys: ['createTableRow'],
          getGroupConfigForJob: async () => ({ id: 'batch-grp' }),
        },
      },
    },
    'plain-app': {
      queue: {
        getGroupConfigForJob: async () => ({ id: 'file-grp' }),
      },
    },
  },
}))

vi.mock('@/models/step', () => ({
  default: {
    query: () => ({
      findById: () => ({
        throwIfNotFound: async () => ({ key: mocks.stepKey.value }),
      }),
    }),
  },
}))

// Import after the mocks so module-load queue registration uses them.
import {
  appActionQueues,
  appBatchActionQueues,
  enqueueActionJob,
  mainActionQueue,
} from '@/queues/action'

const JOB_DATA = {
  flowId: 'test-flow-id',
  executionId: 'test-exec-id',
  stepId: 'test-step-id',
}

describe('enqueueActionJob routing', () => {
  beforeEach(() => {
    mocks.stepKey.value = 'createTableRow'
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('routes batchable action keys to the dedicated batch queue', async () => {
    mocks.stepKey.value = 'createTableRow'

    await enqueueActionJob({
      appKey: 'batch-app',
      jobName: 'test-job',
      jobData: JOB_DATA,
      jobOptions: {},
    })

    expect(appBatchActionQueues['batch-app'].add).toHaveBeenCalledTimes(1)
    expect(appBatchActionQueues['batch-app'].add).toHaveBeenCalledWith(
      'test-job',
      JOB_DATA,
      expect.objectContaining({ group: { id: 'batch-grp' } }),
    )
    expect(appActionQueues['batch-app'].add).not.toHaveBeenCalled()
  })

  it('routes non-batchable action keys to the existing app queue', async () => {
    mocks.stepKey.value = 'writeCellValues'

    await enqueueActionJob({
      appKey: 'batch-app',
      jobName: 'test-job',
      jobData: JOB_DATA,
      jobOptions: {},
    })

    expect(appActionQueues['batch-app'].add).toHaveBeenCalledTimes(1)
    expect(appActionQueues['batch-app'].add).toHaveBeenCalledWith(
      'test-job',
      JOB_DATA,
      expect.objectContaining({ group: { id: 'file-grp' } }),
    )
    expect(appBatchActionQueues['batch-app'].add).not.toHaveBeenCalled()
  })

  it('routes apps without a batch config to their existing queue', async () => {
    mocks.stepKey.value = 'createTableRow'

    await enqueueActionJob({
      appKey: 'plain-app',
      jobName: 'test-job',
      jobData: JOB_DATA,
      jobOptions: {},
    })

    expect(appActionQueues['plain-app'].add).toHaveBeenCalledTimes(1)
    expect(appActionQueues['plain-app'].add).toHaveBeenCalledWith(
      'test-job',
      JOB_DATA,
      expect.objectContaining({ group: { id: 'file-grp' } }),
    )
    // plain-app has no batch queue registered at all.
    expect(appBatchActionQueues['plain-app']).toBeUndefined()
  })

  it('routes unknown apps to the main action queue', async () => {
    await enqueueActionJob({
      appKey: 'app-without-queue',
      jobName: 'test-job',
      jobData: JOB_DATA,
      jobOptions: {},
    })

    expect(mainActionQueue.add).toHaveBeenCalledTimes(1)
    expect(appActionQueues['batch-app'].add).not.toHaveBeenCalled()
    expect(appActionQueues['plain-app'].add).not.toHaveBeenCalled()
  })
})
