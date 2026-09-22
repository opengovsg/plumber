import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  actionBatchQueues,
  actionQueuesByName,
  appActionQueues,
  enqueueActionJob,
  getActionJob,
  MAIN_ACTION_QUEUE_NAME,
  MAIN_ACTION_QUEUE_REDIS_CONNECTION_PREFIX,
} from '@/queues/action'

const mocks = vi.hoisted(() => ({
  // Return a distinct stub per queue so routing tests can assert which queue's
  // `add` was called.
  makeActionQueue: vi.fn((params: { queueName: string }) => ({
    name: params.queueName,
    add: vi.fn(async () => ({ id: 'stub-job-id' })),
    getJob: vi.fn(async () => ({ id: 'stub-found-job' })),
    // Needed so the module's SIGTERM handler (which calls q?.close()) doesn't
    // throw on teardown now that the mock returns a real object.
    close: vi.fn(async () => undefined),
  })),
  appGetGroupConfig: vi.fn(async () => ({ id: 'file-1' })),
  batchGetGroupConfig: vi.fn(async () => ({ id: 'file-1::table-1' })),
  // Defaults to 'all', matching the flag's fallback value.
  getLdFlagValue: vi.fn(async () => 'all'),
  // Resolves the flow lookup used by the 'ogp' rollout state.
  flowWithGraphFetched: vi.fn(async () => ({
    user: { email: 'someone@open.gov.sg' },
  })),
}))

vi.mock('@/queues/helpers/make-action-queue', () => ({
  makeActionQueue: mocks.makeActionQueue,
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getLdFlagValue: mocks.getLdFlagValue,
}))

vi.mock('@/models/flow', () => ({
  default: {
    query: vi.fn(() => ({
      findById: vi.fn(() => ({
        withGraphFetched: mocks.flowWithGraphFetched,
      })),
    })),
  },
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
    // Mirrors m365-excel: it has a per-app queue (for non-batched actions) AND
    // a batch-enabled action routed to a dedicated batch queue.
    'app-with-batch': {
      queue: {
        getGroupConfigForJob: mocks.appGetGroupConfig,
      },
      actions: [
        {
          key: 'batchedAction',
          batch: {
            getGroupConfigForJob: mocks.batchGetGroupConfig,
          },
        },
        {
          key: 'nonBatchedAction',
        },
      ],
    },
    // Real app/action keys, needed because the 'ogp' rollout state is scoped
    // by literal appKey/actionKey check, not by the generic batch config.
    'm365-excel': {
      queue: {
        getGroupConfigForJob: mocks.appGetGroupConfig,
      },
      actions: [
        {
          key: 'createTableRow',
          batch: {
            getGroupConfigForJob: mocks.batchGetGroupConfig,
          },
        },
      ],
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

  it('creates a batch queue for each app that has a batch-enabled action', () => {
    expect(mocks.makeActionQueue).toHaveBeenCalledWith({
      queueName: '{app-actions-app-with-batch-batch}',
    })
    expect(mocks.makeActionQueue).toHaveBeenCalledWith({
      queueName: '{app-actions-m365-excel-batch}',
    })
  })

  it('does not create batch queues for apps without batch-enabled actions', () => {
    expect(mocks.makeActionQueue).not.toHaveBeenCalledWith({
      queueName: '{app-actions-app-with-queue-1-batch}',
    })
  })

  it('stores app-specific queues in the appActionQueues record', () => {
    expect(Object.keys(appActionQueues)).toMatchObject([
      'app-with-queue-1',
      'app-with-queue-2',
      'app-with-batch',
      'm365-excel',
    ])
  })

  it('stores batch queues in the actionBatchQueues record', () => {
    expect(Object.keys(actionBatchQueues)).toMatchObject([
      'app-with-batch',
      'm365-excel',
    ])
  })

  it('stores all created queues (incl. batch) in actionQueuesByName map', () => {
    expect(Object.keys(actionQueuesByName)).toMatchObject([
      MAIN_ACTION_QUEUE_NAME,
      '{app-actions-app-with-queue-1}',
      '{app-actions-app-with-queue-2}',
      '{app-actions-app-with-batch}',
      '{app-actions-m365-excel}',
      '{app-actions-app-with-batch-batch}',
      '{app-actions-m365-excel-batch}',
    ])
  })
})

describe('enqueueActionJob routing', () => {
  const jobData = {
    flowId: 'flow-1',
    executionId: 'exec-1',
    stepId: 'step-1',
  }
  const jobOptions = { attempts: 1 }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getLdFlagValue.mockResolvedValue('all')
    mocks.flowWithGraphFetched.mockResolvedValue({
      user: { email: 'someone@open.gov.sg' },
    })
  })

  it('routes a batch-enabled action to its dedicated batch queue with the batch group config', async () => {
    await enqueueActionJob({
      appKey: 'app-with-batch',
      actionKey: 'batchedAction',
      jobName: 'job-1',
      jobData,
      jobOptions,
    })

    expect(mocks.batchGetGroupConfig).toHaveBeenCalledWith(jobData)
    expect(actionBatchQueues['app-with-batch'].add).toHaveBeenCalledWith(
      'job-1',
      jobData,
      {
        ...jobOptions,
        group: { id: 'file-1::table-1' },
      },
    )
    // The per-app (non-batch) queue must not receive it.
    expect(appActionQueues['app-with-batch'].add).not.toHaveBeenCalled()
  })

  it('falls back to the per-app queue when the rollout flag is off', async () => {
    mocks.getLdFlagValue.mockResolvedValue('off')

    await enqueueActionJob({
      appKey: 'app-with-batch',
      actionKey: 'batchedAction',
      jobName: 'job-1',
      jobData,
      jobOptions,
    })

    expect(mocks.getLdFlagValue).toHaveBeenCalledWith(
      'm365-excel-batch-rollout',
      null,
      'all',
    )
    expect(appActionQueues['app-with-batch'].add).toHaveBeenCalledWith(
      'job-1',
      jobData,
      {
        ...jobOptions,
        group: { id: 'file-1' },
      },
    )
    expect(actionBatchQueues['app-with-batch'].add).not.toHaveBeenCalled()
  })

  it('routes createTableRow to the batch queue when rollout is ogp and the flow owner is an OGP user', async () => {
    mocks.getLdFlagValue.mockResolvedValue('ogp')
    mocks.flowWithGraphFetched.mockResolvedValue({
      user: { email: 'Someone@Open.Gov.Sg' },
    })

    await enqueueActionJob({
      appKey: 'm365-excel',
      actionKey: 'createTableRow',
      jobName: 'job-1',
      jobData,
      jobOptions,
    })

    expect(actionBatchQueues['m365-excel'].add).toHaveBeenCalledWith(
      'job-1',
      jobData,
      {
        ...jobOptions,
        group: { id: 'file-1::table-1' },
      },
    )
    expect(appActionQueues['m365-excel'].add).not.toHaveBeenCalled()
  })

  it('falls back to the per-app queue when rollout is ogp and the flow owner is not an OGP user', async () => {
    mocks.getLdFlagValue.mockResolvedValue('ogp')
    mocks.flowWithGraphFetched.mockResolvedValue({
      user: { email: 'someone@example.com' },
    })

    await enqueueActionJob({
      appKey: 'm365-excel',
      actionKey: 'createTableRow',
      jobName: 'job-1',
      jobData,
      jobOptions,
    })

    expect(appActionQueues['m365-excel'].add).toHaveBeenCalledWith(
      'job-1',
      jobData,
      {
        ...jobOptions,
        group: { id: 'file-1' },
      },
    )
    expect(actionBatchQueues['m365-excel'].add).not.toHaveBeenCalled()
  })

  it('falls back to the per-app queue when rollout is ogp for a batch action other than createTableRow', async () => {
    mocks.getLdFlagValue.mockResolvedValue('ogp')

    await enqueueActionJob({
      appKey: 'app-with-batch',
      actionKey: 'batchedAction',
      jobName: 'job-1',
      jobData,
      jobOptions,
    })

    expect(mocks.flowWithGraphFetched).not.toHaveBeenCalled()
    expect(appActionQueues['app-with-batch'].add).toHaveBeenCalledWith(
      'job-1',
      jobData,
      {
        ...jobOptions,
        group: { id: 'file-1' },
      },
    )
    expect(actionBatchQueues['app-with-batch'].add).not.toHaveBeenCalled()
  })

  it('routes a non-batch action of the same app to the per-app queue', async () => {
    await enqueueActionJob({
      appKey: 'app-with-batch',
      actionKey: 'nonBatchedAction',
      jobName: 'job-2',
      jobData,
      jobOptions,
    })

    expect(appActionQueues['app-with-batch'].add).toHaveBeenCalledWith(
      'job-2',
      jobData,
      {
        ...jobOptions,
        group: { id: 'file-1' },
      },
    )
    expect(actionBatchQueues['app-with-batch'].add).not.toHaveBeenCalled()
  })

  it('routes an app without a queue config to the main queue', async () => {
    await enqueueActionJob({
      appKey: null,
      actionKey: null,
      jobName: 'job-3',
      jobData,
      jobOptions,
    })

    expect(actionQueuesByName[MAIN_ACTION_QUEUE_NAME].add).toHaveBeenCalledWith(
      'job-3',
      jobData,
      jobOptions,
    )
  })

  it('resolves a batched job id back to its batch queue (for bulk-retry)', async () => {
    const batchQueue = actionQueuesByName['{app-actions-app-with-batch-batch}']

    await getActionJob('{app-actions-app-with-batch-batch}:123')

    expect(batchQueue.getJob).toHaveBeenCalledWith('123')
  })
})
