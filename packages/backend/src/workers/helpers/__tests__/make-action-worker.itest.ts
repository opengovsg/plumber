import type { IActionJobData } from '@plumber/types'
import type { JobPro } from '@taskforcesh/bullmq-pro'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  generateMockContext,
  generateMockTable,
  generateMockTableColumns,
} from '@/graphql/__tests__/mutations/tiles/table.mock'
import { DEFAULT_JOB_OPTIONS } from '@/helpers/default-job-configuration'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Flow from '@/models/flow'
import TableMetadata from '@/models/table-metadata'
import { getTableOperations } from '@/models/tiles/factory'
import {
  actionQueuesByName,
  appActionQueues,
  enqueueActionJob,
} from '@/queues/action'
import { appActionWorkers, mainActionWorker } from '@/workers/action'

const mocks = vi.hoisted(() => ({
  getLdFlagValue: vi.fn(async () => 'all'),
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getLdFlagValue: mocks.getLdFlagValue,
}))

// Plain functions so restoreAllMocks in sibling files cannot wipe them.
vi.mock('@/helpers/tracer', () => ({
  default: {
    scope: () => ({ active: () => ({ addTags: (): void => undefined }) }),
    wrap: (_name: string, callback: unknown) => callback,
  },
}))

vi.mock('@/helpers/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('@/helpers/generate-error-email', () => ({
  isErrorEmailAlreadySent: vi.fn(async () => false),
  sendErrorEmail: vi.fn(async () => ({})),
}))

const tilesQueue = appActionQueues['tiles']
const tilesWorker = appActionWorkers['tiles']

async function waitFor(
  predicate: () => Promise<boolean>,
  timeout = 20000,
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await predicate()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Timed out waiting for condition')
}

describe('action worker: tiles frozen for migration', () => {
  beforeAll(async () => {
    await tilesWorker.waitUntilReady()
  })

  afterAll(async () => {
    await tilesQueue.obliterate({ force: true })
    await Promise.all(
      [mainActionWorker, ...Object.values(appActionWorkers)].map((w) =>
        w?.close(),
      ),
    )
    await Promise.all(Object.values(actionQueuesByName).map((q) => q.close()))
  })

  it('re-queues a frozen write without an attempt, then writes after the freeze lifts', async () => {
    const context = await generateMockContext()
    const { table } = await generateMockTable({
      userId: context.currentUser.id,
      databaseType: 'ddb',
    })
    const [columnId] = await generateMockTableColumns({
      tableId: table.id,
      numColumns: 1,
      databaseType: 'ddb',
    })
    await TableMetadata.query()
      .patch({ migrationStartedAt: new Date() })
      .where({ id: table.id })

    const flow = await Flow.query().insertGraphAndFetch({
      userId: context.currentUser.id,
      name: 'tile-migration-requeue-itest',
      steps: [
        {
          appKey: 'mock-app',
          key: 'mock-trigger',
          type: 'trigger',
          position: 1,
          status: 'completed',
        },
        {
          appKey: 'tiles',
          key: 'createTileRow',
          type: 'action',
          position: 2,
          status: 'completed',
          parameters: {
            tableId: table.id,
            rowData: [{ columnId, cellValue: 'hello' }],
          },
        },
      ],
    })
    const step = flow.steps.find((s) => s.key === 'createTileRow')
    const execution = await Execution.query().insertAndFetch({
      flowId: flow.id,
      testRun: false,
    })

    const job = (await enqueueActionJob({
      appKey: 'tiles',
      actionKey: 'createTileRow',
      jobName: `${execution.id}-${step.id}`,
      jobData: {
        flowId: flow.id,
        executionId: execution.id,
        stepId: step.id,
      },
      jobOptions: DEFAULT_JOB_OPTIONS,
    })) as JobPro<IActionJobData>

    await waitFor(async () => (await job.getState()) === 'delayed')
    const delayed = await tilesQueue.getJob(job.id)
    expect(delayed.attemptsMade).toBe(0)
    expect(delayed.data.requeuesWithoutAttempt).toBe(1)
    expect(
      await ExecutionStep.query().where('execution_id', execution.id),
    ).toHaveLength(0)

    await TableMetadata.query()
      .patch({ migrationStartedAt: null })
      .where({ id: table.id })
    await delayed.promote()

    await waitFor(async () => (await job.getState()) === 'completed')
    const executionSteps = await ExecutionStep.query().where(
      'execution_id',
      execution.id,
    )
    expect(executionSteps).toHaveLength(1)
    expect(executionSteps[0].status).toBe('success')

    const { rows } = await getTableOperations('ddb').getTableRows({
      tableId: table.id,
      columnIds: [columnId],
    })
    expect(rows.map((r) => r.data[columnId])).toEqual(['hello'])
  })
})
