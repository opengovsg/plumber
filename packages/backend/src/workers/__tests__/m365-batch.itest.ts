import { UnrecoverableError } from '@taskforcesh/bullmq-pro'
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

import RetriableError from '@/errors/retriable-error'
import { DEFAULT_JOB_OPTIONS } from '@/helpers/default-job-configuration'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Flow from '@/models/flow'
import Step from '@/models/step'
import User from '@/models/user'
import {
  actionBatchQueues,
  actionQueuesByName,
  enqueueActionJob,
  mainActionQueue,
} from '@/queues/action'
import {
  appActionBatchWorkers,
  appActionWorkers,
  mainActionWorker,
} from '@/workers/action'

import {
  backupWorker,
  flushQueue,
  restoreWorker,
  type WorkerState,
} from './test-helpers'

//
// This is the only end-to-end test that drives the REAL m365-excel
// `createTableRow` action through the REAL BullMQ-Pro batch worker over real
// Redis + Postgres. The ONLY thing stubbed is the MS Graph HTTP layer
// (WorkbookSession), so the single multi-row POST is observable and we never
// touch the network. Everything else - routing (enqueueActionJob), grouping
// (group affinity by `${fileId}::${tableId}`), the batch processor, per-job
// execution-step recording, next-step enqueueing, for-each bookkeeping - runs
// for real.
//

const mocks = vi.hoisted(() => ({
  // WorkbookSession.acquire() -> { request }. `request` is the single seam we
  // drive: GET returns the table header, POST is the multi-row insert.
  acquire: vi.fn(),
  request: vi.fn(),
  // dd-trace span tag sink, so we can assert the Phase 4 batch span measures.
  addSpanTags: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
}))

vi.mock('@/apps/m365-excel/common/workbook-session', () => ({
  default: {
    acquire: mocks.acquire,
  },
}))

// scope/wrap are plain functions (not vi.fn) so vi.restoreAllMocks() in
// afterEach - which we use to clean per-test spies - cannot wipe them and
// break tracing in the next test.
vi.mock('@/helpers/tracer', () => ({
  default: {
    scope: () => ({ active: () => ({ addTags: mocks.addSpanTags }) }),
    wrap: (_name: string, callback: unknown) => callback,
  },
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    info: mocks.logInfo,
    error: mocks.logError,
    warn: vi.fn(),
  },
}))

// The worker's `failed` handler sends an error email on permanent failure; we
// only care that it marks the execution failed, so stub the email out.
vi.mock('@/helpers/generate-error-email', () => ({
  isErrorEmailAlreadySent: vi.fn(async () => false),
  sendErrorEmail: vi.fn(async () => ({})),
}))

// 0-indexed header row => header sits at sheet row HEADER_ROW_INDEX + 1.
const HEADER_ROW_INDEX = 9
const FILE_ID = 'file-1'
const TABLE_ID = '{table-1}'
// Single-column tables keep the assertions about per-job row data simple.
const COLUMN_NAME = 'Name'

const batchWorker = appActionBatchWorkers['m365-excel']
const batchQueue = actionBatchQueues['m365-excel']

let userId: string

//
// Graph stubs
//

// GET (header fetch) always succeeds; POST (the multi-row insert) returns the
// table-index of the first inserted row (Approach A).
function mockGraphSuccess(firstRowIndex = 0): void {
  mocks.request.mockImplementation(
    async (_endpoint: string, method: string) => {
      if (method === 'get') {
        return { data: { rowIndex: HEADER_ROW_INDEX, values: [[COLUMN_NAME]] } }
      }
      return { data: { index: firstRowIndex } }
    },
  )
}

// Header fetch succeeds, but the row insert throws - this is the single
// throw/retry point, so the whole batch must fail all-or-none.
function mockGraphPostError(error: Error): void {
  mocks.request.mockImplementation(
    async (_endpoint: string, method: string) => {
      if (method === 'get') {
        return { data: { rowIndex: HEADER_ROW_INDEX, values: [[COLUMN_NAME]] } }
      }
      throw error
    },
  )
}

// Each request mock call is [endpoint, method, config].
function postConfigs(): Array<{
  data: { index: number | null; values: string[][] }
  urlPathParams: { tableId: string }
}> {
  return mocks.request.mock.calls
    .filter(([, method]) => method === 'post')
    .map(([, , config]) => config)
}

//
// Test data
//

interface CreateRowFlow {
  flow: Flow
  createTableRowStep: Step
  forEachStep: Step | undefined
  execution: Execution
}

// Builds a flow containing a single createTableRow step (+ optional preceding
// for-each and following step) and a fresh execution for it.
async function buildCreateRowFlow(options: {
  rowValue: string
  tableId?: string
  withNextStep?: boolean
  withForEach?: boolean
}): Promise<CreateRowFlow> {
  const {
    rowValue,
    tableId = TABLE_ID,
    withNextStep = false,
    withForEach = false,
  } = options

  let position = 1
  const steps: Array<Record<string, unknown>> = [
    {
      appKey: 'mock-app',
      key: 'mock-trigger',
      type: 'trigger',
      position: position++,
      status: 'completed',
    },
  ]
  if (withForEach) {
    steps.push({
      appKey: 'toolbox',
      key: 'forEach',
      type: 'action',
      position: position++,
      status: 'completed',
    })
  }
  steps.push({
    appKey: 'm365-excel',
    key: 'createTableRow',
    type: 'action',
    position: position++,
    status: 'completed',
    parameters: {
      fileId: FILE_ID,
      tableId,
      columnValues: [{ columnName: COLUMN_NAME, value: rowValue }],
    },
  })
  if (withNextStep) {
    steps.push({
      appKey: 'mock-app',
      key: 'noop',
      type: 'action',
      position: position++,
      status: 'completed',
    })
  }

  const flow = await Flow.query().insertGraphAndFetch({
    userId,
    name: 'm365-batch-itest',
    steps,
  })

  const execution = await Execution.query().insertAndFetch({
    flowId: flow.id,
    testRun: false,
  })

  return {
    flow,
    createTableRowStep: flow.steps.find((s) => s.key === 'createTableRow'),
    forEachStep: flow.steps.find((s) => s.key === 'forEach'),
    execution,
  }
}

async function enqueueCreateRowJob(options: {
  flow: Flow
  createTableRowStep: Step
  execution: Execution
  metadata?: Record<string, unknown>
  attempts?: number
}): Promise<void> {
  const { flow, createTableRowStep, execution, metadata, attempts } = options
  await enqueueActionJob({
    appKey: 'm365-excel',
    actionKey: 'createTableRow',
    jobName: `${execution.id}-${createTableRowStep.id}${
      metadata?.iteration ? `-${metadata.iteration}` : ''
    }`,
    jobData: {
      flowId: flow.id,
      executionId: execution.id,
      stepId: createTableRowStep.id,
      ...(metadata ? { metadata } : {}),
    },
    jobOptions: {
      ...DEFAULT_JOB_OPTIONS,
      ...(attempts ? { attempts } : {}),
    },
  })
}

async function createTableRowSteps(
  status?: 'success' | 'failure',
): Promise<ExecutionStep[]> {
  const query = ExecutionStep.query().where('key', 'createTableRow')
  if (status) {
    query.where('status', status)
  }
  return query
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Workers process asynchronously, so poll for the terminal DB/mock state rather
// than racing a single worker event.
async function waitFor(
  predicate: () => Promise<boolean> | boolean,
  {
    timeout = 20000,
    interval = 50,
  }: { timeout?: number; interval?: number } = {},
): Promise<void> {
  const start = Date.now()
  let lastError: unknown = null
  while (Date.now() - start < timeout) {
    try {
      if (await predicate()) {
        return
      }
    } catch (error) {
      lastError = error
    }
    await sleep(interval)
  }
  throw new Error(
    `waitFor timed out after ${timeout}ms` +
      (lastError ? `: ${String(lastError)}` : ''),
  )
}

describe('m365-excel batch worker (integration)', () => {
  let originalBatchState: WorkerState
  let originalMainState: WorkerState

  beforeAll(async () => {
    originalBatchState = await backupWorker(batchWorker)
    originalMainState = await backupWorker(mainActionWorker)
    await batchWorker.waitUntilReady()
    await mainActionWorker.waitUntilReady()
  })

  beforeEach(async () => {
    mocks.acquire.mockResolvedValue({ request: mocks.request })
    userId = (await User.query().findOne({ email: 'tester@open.gov.sg' })).id

    // Pause both workers so we can enqueue every job up front (the batch worker
    // then fetches them all as one batch on resume) and so next-step jobs the
    // batch worker enqueues onto the main queue persist for assertion instead
    // of being consumed.
    await batchWorker.pause()
    await mainActionWorker.pause()
  })

  afterEach(async () => {
    await flushQueue(batchQueue, batchWorker)
    await flushQueue(mainActionQueue, mainActionWorker)
    restoreWorker(batchWorker, originalBatchState)
    restoreWorker(mainActionWorker, originalMainState)
    vi.restoreAllMocks()
  })

  // Close workers + queues so they don't linger in the shared test process and
  // steal jobs from later itest files on the same Redis queues.
  afterAll(async () => {
    await Promise.all(
      [
        mainActionWorker,
        ...Object.values(appActionWorkers),
        ...Object.values(appActionBatchWorkers),
      ].map((w) => w?.close()),
    )
    await Promise.all(Object.values(actionQueuesByName).map((q) => q.close()))
  })

  it('coalesces same-file/table jobs into one batch with a single Graph POST', async () => {
    mockGraphSuccess(0)

    const rowValues = ['Alice', 'Bob', 'Carol']
    const flows = await Promise.all(
      rowValues.map((rowValue) =>
        buildCreateRowFlow({ rowValue, withNextStep: true }),
      ),
    )

    for (const f of flows) {
      await enqueueCreateRowJob(f)
    }

    batchWorker.resume()

    await waitFor(
      async () =>
        postConfigs().length === 1 &&
        (await createTableRowSteps('success')).length === rowValues.length,
    )

    // One multi-row POST for the whole batch, header read once.
    const posts = postConfigs()
    expect(posts).toHaveLength(1)
    expect(
      mocks.request.mock.calls.filter(([, method]) => method === 'get'),
    ).toHaveLength(1)

    // Each job contributed its own row, in some batch order.
    const [postConfig] = posts
    expect(postConfig.data.index).toBeNull()
    expect(postConfig.data.values).toHaveLength(rowValues.length)
    expect(postConfig.data.values).toEqual(
      expect.arrayContaining(rowValues.map((value) => [value])),
    )

    // Each job recorded its own success step with its own sheetRowNumber.
    // firstRowIndex 0 => HEADER_ROW_INDEX + 1 + (0 + i) + 1 = 11, 12, 13.
    const successSteps = await createTableRowSteps('success')
    expect(successSteps).toHaveLength(rowValues.length)
    const sheetRowNumbers = successSteps
      .map(
        (step) => (step.dataOut as { sheetRowNumber: number }).sheetRowNumber,
      )
      .sort((a, b) => a - b)
    expect(sheetRowNumbers).toEqual([11, 12, 13])

    // Each job enqueued its own next step onto the main queue.
    const nextStepJobs = await mainActionQueue.getWaiting()
    expect(nextStepJobs).toHaveLength(rowValues.length)

    // Phase 4 span measures on the processed batch.
    expect(mocks.addSpanTags).toHaveBeenCalledWith(
      expect.objectContaining({
        'batch.size': rowValues.length,
        'batch.configured_size': 10,
        'batch.fill_ratio': rowValues.length / 10,
        'm365.api_calls_saved': rowValues.length - 1,
      }),
    )
    expect(mocks.addSpanTags).toHaveBeenCalledWith(
      expect.objectContaining({ 'batch.outcome': 'success' }),
    )
  }, 30000)

  it('forms separate batches for different tables in the same file', async () => {
    mockGraphSuccess(0)

    const tableOne = '{table-1}'
    const tableTwo = '{table-2}'
    const jobs = [
      await buildCreateRowFlow({ rowValue: 'A1', tableId: tableOne }),
      await buildCreateRowFlow({ rowValue: 'A2', tableId: tableOne }),
      await buildCreateRowFlow({ rowValue: 'B1', tableId: tableTwo }),
    ]

    for (const f of jobs) {
      await enqueueCreateRowJob(f)
    }

    batchWorker.resume()

    // Two groups => two batches => two POSTs.
    await waitFor(async () => postConfigs().length === 2)
    await sleep(200) // guard against a stray third POST

    const posts = postConfigs()
    const tableOnePost = posts.find(
      (config) => config.urlPathParams.tableId === tableOne,
    )
    const tableTwoPost = posts.find(
      (config) => config.urlPathParams.tableId === tableTwo,
    )

    expect(posts).toHaveLength(2)
    expect(tableOnePost?.data.values).toEqual(
      expect.arrayContaining([['A1'], ['A2']]),
    )
    expect(tableOnePost?.data.values).toHaveLength(2)
    expect(tableTwoPost?.data.values).toEqual([['B1']])
  }, 30000)

  it('fails the whole batch all-or-none when the Graph POST fails', async () => {
    // A plain error is non-retriable -> the batch fails once (no retry), so the
    // assertion on POST-call count is deterministic.
    mockGraphPostError(new Error('Graph POST failed'))

    const flows = await Promise.all(
      ['Alice', 'Bob'].map((rowValue) =>
        buildCreateRowFlow({ rowValue, withNextStep: true }),
      ),
    )

    for (const f of flows) {
      await enqueueCreateRowJob(f)
    }

    batchWorker.resume()

    // Every job in the batch gets a failure execution step...
    await waitFor(
      async () =>
        (await createTableRowSteps('failure')).length === flows.length,
    )
    await sleep(200)

    expect((await createTableRowSteps('success')).length).toBe(0)
    const failureSteps = await createTableRowSteps('failure')
    expect(failureSteps).toHaveLength(flows.length)
    for (const step of failureSteps) {
      expect(step.errorDetails).not.toBeNull()
    }

    // ...no next steps are enqueued...
    expect(await mainActionQueue.getWaiting()).toHaveLength(0)

    // ...and the single multi-row POST is not retried (non-retriable error).
    expect(postConfigs()).toHaveLength(1)
    expect(mocks.addSpanTags).toHaveBeenCalledWith(
      expect.objectContaining({ 'batch.outcome': 'failed' }),
    )
  }, 30000)

  it('retries the whole batch on a retriable Graph error', async () => {
    // A RetriableError (step delay) drives the normal retry path; a small delay
    // keeps the test fast.
    mockGraphPostError(
      new RetriableError({
        error: 'transient graph error',
        delayInMs: 50,
        delayType: 'step',
      }),
    )

    const flows = await Promise.all(
      ['Alice', 'Bob'].map((rowValue) => buildCreateRowFlow({ rowValue })),
    )

    for (const f of flows) {
      await enqueueCreateRowJob({ ...f, attempts: 2 })
    }

    batchWorker.resume()

    // attempts: 2 => the batch is retried, so runBatch (and its POST) runs more
    // than once. Note: on retry bullmq-pro does not necessarily re-coalesce the
    // batch (each job can come back as its own batch), so the POST count can
    // exceed the attempt count - we only assert that a retry happened. Exact
    // batch-retry semantics are pinned down in the per-file-lock phase.
    await waitFor(async () => postConfigs().length >= 2, { timeout: 25000 })
    await sleep(200)

    expect(postConfigs().length).toBeGreaterThanOrEqual(2)
    // Still all-or-none: no successes, no next steps.
    expect((await createTableRowSteps('success')).length).toBe(0)
    expect(await mainActionQueue.getWaiting()).toHaveLength(0)
  }, 30000)

  describe('for-each of createTableRow as the last step', () => {
    const ITERATIONS = 3

    // Seeds the for-each step's execution step with an all-null iterationStatus
    // map, mirroring what the real toolbox for-each step writes before fanning
    // out its iterations.
    async function seedForEachStep(
      execution: Execution,
      forEachStep: Step,
    ): Promise<void> {
      const iterationStatus: Record<string, null> = {}
      for (let i = 1; i <= ITERATIONS; i++) {
        iterationStatus[`iteration_${i}`] = null
      }
      await ExecutionStep.query().insert({
        executionId: execution.id,
        stepId: forEachStep.id,
        appKey: 'toolbox',
        key: 'forEach',
        status: 'success',
        dataIn: {},
        dataOut: { iterations: ITERATIONS },
        metadata: { iterations: ITERATIONS, iterationStatus },
      })
    }

    async function enqueueIterations(
      flow: CreateRowFlow,
      attempts?: number,
    ): Promise<void> {
      for (let i = 1; i <= ITERATIONS; i++) {
        await enqueueCreateRowJob({
          flow: flow.flow,
          createTableRowStep: flow.createTableRowStep,
          execution: flow.execution,
          metadata: {
            iteration: i,
            iterations: ITERATIONS,
            isLastIteration: i === ITERATIONS,
          },
          attempts,
        })
      }
    }

    async function getForEachIterationStatus(
      executionId: string,
    ): Promise<Record<string, string | null>> {
      const forEachStep = await ExecutionStep.query()
        .where('execution_id', executionId)
        .where('app_key', 'toolbox')
        .where('key', 'forEach')
        .first()
      return (
        forEachStep?.metadata as {
          iterationStatus: Record<string, string | null>
        }
      ).iterationStatus
    }

    it('resolves the execution to success exactly once when all iterations succeed', async () => {
      mockGraphSuccess(0)
      const setStatusSpy = vi.spyOn(Execution, 'setStatus')

      const flow = await buildCreateRowFlow({
        rowValue: 'iter',
        withForEach: true,
      })
      await seedForEachStep(flow.execution, flow.forEachStep)
      await enqueueIterations(flow)

      batchWorker.resume()

      await waitFor(async () => {
        const execution = await Execution.query().findById(flow.execution.id)
        return execution.status === 'success'
      })
      await sleep(200)

      // One batch -> one POST with all iteration rows.
      const posts = postConfigs()
      expect(posts).toHaveLength(1)
      expect(posts[0].data.values).toHaveLength(ITERATIONS)

      // Every iteration slot was filled with 'success'.
      const iterationStatus = await getForEachIterationStatus(flow.execution.id)
      expect(Object.values(iterationStatus)).toEqual(
        Array(ITERATIONS).fill('success'),
      )

      // Each iteration recorded its own success step.
      expect((await createTableRowSteps('success')).length).toBe(ITERATIONS)

      // The execution was marked success exactly once (no premature/duplicate
      // completion).
      const successCalls = setStatusSpy.mock.calls.filter(
        ([id, status]) => id === flow.execution.id && status === 'success',
      )
      expect(successCalls).toHaveLength(1)
    }, 30000)

    it('patches every iteration to failure and resolves the execution to failure when the batch fails', async () => {
      // Non-retriable -> the batch fails immediately and the worker's failed
      // handler marks the (single, shared) execution failed.
      mockGraphPostError(new UnrecoverableError('Graph POST failed'))

      const flow = await buildCreateRowFlow({
        rowValue: 'iter',
        withForEach: true,
      })
      await seedForEachStep(flow.execution, flow.forEachStep)
      await enqueueIterations(flow)

      batchWorker.resume()

      // The execution resolves to failure - it must not hang at null.
      await waitFor(async () => {
        const execution = await Execution.query().findById(flow.execution.id)
        return execution.status === 'failure'
      })
      await sleep(200)

      // Every iteration slot was patched to 'failure' (else the for-each hangs).
      const iterationStatus = await getForEachIterationStatus(flow.execution.id)
      expect(Object.values(iterationStatus)).toEqual(
        Array(ITERATIONS).fill('failure'),
      )

      // Each iteration recorded a failure step; no successes, no next steps.
      expect((await createTableRowSteps('failure')).length).toBe(ITERATIONS)
      expect((await createTableRowSteps('success')).length).toBe(0)
      expect(await mainActionQueue.getWaiting()).toHaveLength(0)
    }, 30000)
  })
})
