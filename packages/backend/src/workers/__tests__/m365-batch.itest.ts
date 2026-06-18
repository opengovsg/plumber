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
import { withLock } from '@/helpers/distributed-lock'
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
// (group affinity by `${fileId}::${tableId}::${connectionId}`), the batch
// processor, per-job execution-step recording, next-step enqueueing, for-each
// bookkeeping - runs for real.
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
  // The action's getLockKey hook. Defaults to null (lock disabled) so the
  // happy-path tests are unaffected; the per-file lock tests override it to
  // engage the REAL distributed lock (imported below, unmocked).
  getLockKey: vi.fn(),
  // The file-access check that createTableRow's runBatch runs ONCE per batch
  // (the batch group key pins every job to one connection). Defaults to
  // resolving (access granted) so happy-path tests are unaffected; the
  // access-denial tests make it reject to fail the whole batch. In production
  // this runs inside WorkbookSession.acquire (mocked here), but runBatch calls
  // file-privacy directly (so we mock it).
  validateCanAccessFile: vi.fn(),
}))

vi.mock('@/apps/m365-excel/common/workbook-session', () => ({
  default: {
    acquire: mocks.acquire,
  },
}))

vi.mock('@/apps/m365-excel/common/file-lock', () => ({
  getLockKey: mocks.getLockKey,
}))

vi.mock('@/apps/m365-excel/common/file-privacy', () => ({
  validateCanAccessFile: mocks.validateCanAccessFile,
}))

// createTableRow's runBatch derives auth data (to pass to validateCanAccessFile)
// from `$`. The test flows have no real m365 connection, so the real
// extractAuthDataWithPlumberFolder would throw; stub it to a dummy
// (validateCanAccessFile is mocked above, so the value is never actually used).
vi.mock('@/apps/m365-excel/common/auth-data', () => ({
  extractAuthDataWithPlumberFolder: () => ({
    tenantKey: 'itest-tenant',
    folderId: 'ITEST-FOLDER',
  }),
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
  // Produces a step whose params fail createTableRow's schema (empty
  // columnValues) while keeping a valid fileId/tableId, so the job still routes
  // to the same batch group but is isolated by runBatch's per-job params parse.
  badParams?: boolean
}): Promise<CreateRowFlow> {
  const {
    rowValue,
    tableId = TABLE_ID,
    withNextStep = false,
    withForEach = false,
    badParams = false,
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
      // Empty columnValues fails parametersSchema's `.min(1)` -> runBatch's
      // per-job params parse throws -> the job is isolated, batch unaffected.
      columnValues: badParams
        ? []
        : [{ columnName: COLUMN_NAME, value: rowValue }],
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
}) {
  const { flow, createTableRowStep, execution, metadata, attempts } = options
  return await enqueueActionJob({
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
    // Lock disabled by default; the per-file lock tests opt in per test.
    mocks.getLockKey.mockResolvedValue(null)
    // File access granted by default; the partial-failure tests reject one job.
    mocks.validateCanAccessFile.mockResolvedValue(undefined)
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

  it('retries the whole batch when the shared access check fails transiently', async () => {
    mockGraphSuccess(0)
    // A transient access-check error (Graph 429/5xx -> RetriableError) must NOT
    // permanently isolate the batch; it throws so the batch retries, like a
    // transient write failure. A small step delay keeps the test fast.
    mocks.validateCanAccessFile.mockRejectedValue(
      new RetriableError({
        error: 'Encountered HTTP 503 from MS',
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

    // The access check is re-run because the batch is retried (attempts: 2). No
    // POST ever happens (access never passes), and the jobs are NOT isolated as
    // permanent failures on the first transient error.
    await waitFor(
      async () => mocks.validateCanAccessFile.mock.calls.length >= 2,
      { timeout: 25000 },
    )
    await sleep(200)

    expect(mocks.validateCanAccessFile.mock.calls.length).toBeGreaterThanOrEqual(
      2,
    )
    expect(postConfigs()).toHaveLength(0)
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

    it('fails every iteration and writes nothing when the shared file-access check is denied', async () => {
      mockGraphSuccess(0)
      // File access is authorized ONCE for the whole batch (every iteration
      // shares the pipe owner + connection + file), so a denial fails EVERY
      // iteration rather than isolating one. The denial is permanent, so the
      // iterations ride the resolve path (setAsFailed, no retry), NOT the
      // all-or-none throw - and runBatch returns before any POST.
      mocks.validateCanAccessFile.mockRejectedValue(
        new Error('You need write access to use this file.'),
      )

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

      // No POST: runBatch returns before acquiring the session when the shared
      // access check is denied.
      expect(postConfigs()).toHaveLength(0)

      // Every iteration recorded a failure step and had its slot patched to
      // 'failure' (no slot left null, so the for-each does not hang); no
      // successes, no next steps.
      expect((await createTableRowSteps('failure')).length).toBe(ITERATIONS)
      expect((await createTableRowSteps('success')).length).toBe(0)
      const iterationStatus = await getForEachIterationStatus(flow.execution.id)
      expect(Object.values(iterationStatus)).toEqual(
        Array(ITERATIONS).fill('failure'),
      )
      expect(await mainActionQueue.getWaiting()).toHaveLength(0)

      // Resolve-path isolation: each iteration is setAsFailed (UnrecoverableError
      // -> no retry), so all land on the batch queue's failed set.
      expect(await batchQueue.getFailed()).toHaveLength(ITERATIONS)
    }, 30000)
  })

  describe('per-file lock', () => {
    // A unique key so a leaked lock can't bleed into another test (and so the
    // default TTL on a failed-test lock is harmless).
    const LOCK_KEY = 'm365-file-lock-itest:contend'

    // Holds the REAL distributed lock for `key` (via withLock) until released -
    // standing in for a concurrent operation on the same file (a non-batch m365
    // action on the per-app queue, or a second partial batch). `acquired`
    // resolves once the lock is held; `release()` frees it and waits for the
    // holder to settle.
    function holdLock(key: string): {
      acquired: Promise<void>
      release: () => Promise<void>
    } {
      let signalAcquired!: () => void
      const acquired = new Promise<void>((resolve) => {
        signalAcquired = resolve
      })
      let signalRelease!: () => void
      const releaseRequested = new Promise<void>((resolve) => {
        signalRelease = resolve
      })

      const holder = withLock(
        key,
        async () => {
          signalAcquired()
          await releaseRequested
        },
        {
          onContention: () => {
            throw new Error('holdLock: unexpected contention while acquiring')
          },
        },
      )

      return {
        acquired,
        release: async () => {
          signalRelease()
          await holder
        },
      }
    }

    // attemptsMade for each member job, read straight from Redis. Re-queueing a
    // contended batch via moveToDelayed must NOT touch this - unlike the old
    // RetriableError path, which incremented it (and ran exponential backoff) on
    // every contention cycle and would eventually fail the jobs.
    async function attemptsMadeFor(
      ids: (string | undefined)[],
    ): Promise<number[]> {
      const jobs = await Promise.all(
        ids.map((id) => (id ? batchQueue.getJob(id) : undefined)),
      )
      return jobs.map((job) => job?.attemptsMade ?? -1)
    }

    it('serializes against a held lock: no write while held, then processes on release', async () => {
      // Engage the REAL distributed lock for this batch.
      mocks.getLockKey.mockResolvedValue(LOCK_KEY)
      mockGraphSuccess(0)

      // Pre-hold the lock so the batch worker loses the race.
      const held = holdLock(LOCK_KEY)
      await held.acquired

      try {
        const flows = await Promise.all(
          ['Alice', 'Bob'].map((rowValue) => buildCreateRowFlow({ rowValue })),
        )
        const jobIds: (string | undefined)[] = []
        for (const f of flows) {
          jobIds.push((await enqueueCreateRowJob(f)).id)
        }

        batchWorker.resume()

        // While the lock is held the batch cannot write: every acquire attempt
        // loses, so each member is re-queued onto `delayed` (moveToDelayed)
        // before reaching the Graph POST. No POST, no execution step (no spurious
        // failure), no next step - and crucially nothing failed and NO attempt
        // consumed.
        await sleep(1000)
        expect(postConfigs()).toHaveLength(0)
        expect((await createTableRowSteps()).length).toBe(0)
        expect(await mainActionQueue.getWaiting()).toHaveLength(0)
        expect(await batchQueue.getFailed()).toHaveLength(0)
        expect(await attemptsMadeFor(jobIds)).toEqual([0, 0])
      } finally {
        // Release -> a subsequent retry acquires the lock and processes.
        await held.release()
      }

      // After release every job completes successfully, with no failure step
      // ever recorded (the contention re-queues never recorded one).
      await waitFor(
        async () => (await createTableRowSteps('success')).length === 2,
      )
      expect((await createTableRowSteps('failure')).length).toBe(0)
      expect(postConfigs().length).toBeGreaterThanOrEqual(1)
    }, 30000)

    it('sustained contention re-queues without consuming attempts or failing', async () => {
      mocks.getLockKey.mockResolvedValue(LOCK_KEY)
      mockGraphSuccess(0)

      const held = holdLock(LOCK_KEY)
      await held.acquired

      try {
        const flows = await Promise.all(
          ['Alice', 'Bob'].map((rowValue) => buildCreateRowFlow({ rowValue })),
        )
        const jobIds: (string | undefined)[] = []
        for (const f of flows) {
          jobIds.push((await enqueueCreateRowJob(f)).id)
        }

        batchWorker.resume()

        // Hold across many re-queue cycles (the delay is 250-1000ms). Throughout,
        // every member stays at attemptsMade 0 and nothing fails - the old
        // RetriableError path would have climbed attemptsMade toward
        // MAXIMUM_JOB_ATTEMPTS (10) and eventually failed the jobs here.
        for (let i = 0; i < 6; i++) {
          await sleep(500)
          expect(await attemptsMadeFor(jobIds)).toEqual([0, 0])
          expect(await batchQueue.getFailed()).toHaveLength(0)
        }
        expect((await createTableRowSteps()).length).toBe(0)
      } finally {
        await held.release()
      }

      // Once the lock frees the members are processed - proving the group was
      // never wedged by the delay cycles (moveToDelayed keeps group concurrency
      // correct) - and complete successfully with no failure step.
      await waitFor(
        async () => (await createTableRowSteps('success')).length === 2,
      )
      expect((await createTableRowSteps('failure')).length).toBe(0)
    }, 30000)
  })

  describe('partial-batch failure isolation', () => {
    it('isolates a bad-params job and still commits the healthy jobs in one POST', async () => {
      mockGraphSuccess(0)

      // Two healthy jobs + one whose params fail validation. All share the same
      // file+table group, so they coalesce into one batch.
      const good = await Promise.all(
        ['Alice', 'Bob'].map((rowValue) =>
          buildCreateRowFlow({ rowValue, withNextStep: true }),
        ),
      )
      const bad = await buildCreateRowFlow({ rowValue: 'bad', badParams: true })

      for (const f of [...good, bad]) {
        await enqueueCreateRowJob(f)
      }

      batchWorker.resume()

      // The healthy jobs commit (success) and the bad one fails - exactly one
      // POST carrying only the healthy rows.
      await waitFor(
        async () =>
          (await createTableRowSteps('success')).length === good.length &&
          (await createTableRowSteps('failure')).length === 1,
      )
      await sleep(200)

      const posts = postConfigs()
      expect(posts).toHaveLength(1)
      expect(posts[0].data.values).toHaveLength(good.length)
      expect(posts[0].data.values).toEqual(
        expect.arrayContaining([['Alice'], ['Bob']]),
      )

      // Each healthy job recorded success + enqueued its next step; the bad job
      // recorded a single failure step and enqueued nothing.
      expect((await createTableRowSteps('success')).length).toBe(good.length)
      expect((await createTableRowSteps('failure')).length).toBe(1)
      expect(await mainActionQueue.getWaiting()).toHaveLength(good.length)

      expect(mocks.addSpanTags).toHaveBeenCalledWith(
        expect.objectContaining({
          'batch.outcome': 'partial',
          'batch.succeeded_count': good.length,
          'batch.failed_count': 1,
        }),
      )

      // The isolated job is a NORMAL failed job (setAsFailed with
      // UnrecoverableError -> no retry), so it lands on the batch queue's failed
      // set and is bulk-retriable via the existing failed-job retry surface.
      expect(await batchQueue.getFailed()).toHaveLength(1)
    }, 30000)

    it('fails every job and writes nothing when the shared file-access check is denied', async () => {
      mockGraphSuccess(0)
      // File access is authorized ONCE for the whole batch (every job shares the
      // pipe owner + connection + file), so a denial fails EVERY job and writes
      // nothing - it is NOT isolated to one job. The denial is permanent, so the
      // jobs are setAsFailed (no retry), not thrown for an all-or-none retry.
      mocks.validateCanAccessFile.mockRejectedValue(
        new Error('You need write access to use this file.'),
      )

      const flows = await Promise.all(
        ['Alice', 'Bob', 'Carol'].map((rowValue) =>
          buildCreateRowFlow({ rowValue, withNextStep: true }),
        ),
      )
      for (const f of flows) {
        await enqueueCreateRowJob(f)
      }

      batchWorker.resume()

      await waitFor(
        async () =>
          (await createTableRowSteps('failure')).length === flows.length,
      )
      await sleep(200)

      // No POST at all: runBatch returns before the session acquire when the
      // shared access check is denied.
      expect(postConfigs()).toHaveLength(0)
      expect((await createTableRowSteps('success')).length).toBe(0)
      expect((await createTableRowSteps('failure')).length).toBe(flows.length)
      expect(await mainActionQueue.getWaiting()).toHaveLength(0)
      // Every job isolated-failed (no retry), so all show on the failed set.
      expect(await batchQueue.getFailed()).toHaveLength(flows.length)
      expect(mocks.addSpanTags).toHaveBeenCalledWith(
        expect.objectContaining({
          'batch.outcome': 'failed',
          'batch.succeeded_count': 0,
          'batch.failed_count': flows.length,
        }),
      )
    }, 30000)

    it('writes nothing and fails every job when the whole batch is bad', async () => {
      mockGraphSuccess(0)

      const flows = await Promise.all(
        ['a', 'b'].map((rowValue) =>
          buildCreateRowFlow({ rowValue, badParams: true }),
        ),
      )
      for (const f of flows) {
        await enqueueCreateRowJob(f)
      }

      batchWorker.resume()

      await waitFor(
        async () =>
          (await createTableRowSteps('failure')).length === flows.length,
      )
      await sleep(200)

      // No Graph POST at all (no healthy jobs to write).
      expect(postConfigs()).toHaveLength(0)
      expect((await createTableRowSteps('success')).length).toBe(0)
      expect(await mainActionQueue.getWaiting()).toHaveLength(0)
      // Every job isolated-failed (no retry), so all show on the failed set.
      expect(await batchQueue.getFailed()).toHaveLength(flows.length)
      expect(mocks.addSpanTags).toHaveBeenCalledWith(
        expect.objectContaining({
          'batch.outcome': 'failed',
          'batch.succeeded_count': 0,
          'batch.failed_count': flows.length,
        }),
      )
    }, 30000)
  })
})
