import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../config', () => ({
  archivalConfig: {
    archiveDryRun: false,
    archiveRetentionDays: 90,
    archiveBatchSize: 500,
    archiveBatchSleepMs: 0,
    archiveBucket: 'archive-bucket',
    archiveDeletedFlowsOnly: false,
    archiveIntraBatchConcurrency: 10,
  },
}))
vi.mock('../logger')
vi.mock('../s3-client', () => ({
  archiveS3Client: {},
  putArchiveObject: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../archive-execution')
vi.mock('../db', () => ({
  archivalDb: vi.fn(),
  archivalDbReader: vi.fn(),
}))

import { archiveExecution } from '../archive-execution'
import { archivalConfig } from '../config'
import { archivalDb, archivalDbReader } from '../db'
import { runArchivalLoop } from '../run-archival-loop'
import { putArchiveObject } from '../s3-client'
import type { ExecutionRow, ExecutionStepRow } from '../types'

function makeExecution(
  id: string,
  overrides: Partial<ExecutionRow> = {},
): ExecutionRow {
  return {
    id,
    flowId: 'flow-1',
    status: 'success',
    testRun: false,
    internalId: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  }
}

function makeStep(overrides: Partial<ExecutionStepRow> = {}): ExecutionStepRow {
  return {
    id: 'step-1',
    executionId: 'exec-1',
    stepId: 'step-def-1',
    appKey: 'formsg',
    key: 'trigger',
    jobId: null,
    status: 'success',
    dataIn: {},
    dataOut: {},
    errorDetails: null,
    metadata: {},
    createdAt: '2024-01-01T00:00:01.000Z',
    updatedAt: '2024-01-01T00:00:01.000Z',
    deletedAt: null,
    ...overrides,
  }
}

// Callbacks captured from the executions query builder during each test run
let capturedEligibilityCb: ((qb: any) => void) | null = null
let capturedTestExecAntiJoin: {
  table: string
  col1: string
  col2: string
} | null = null
let capturedDeletedFlowsWhereIn: any = null
let capturedModifyCbs: Array<(qb: any) => void> = []

function setupDb(
  batches: ExecutionRow[][],
  stepsByExecutionId: Record<string, ExecutionStepRow[]> = {},
) {
  let batchIdx = 0
  let currentStepsExecutionId: string | null = null
  capturedEligibilityCb = null
  capturedTestExecAntiJoin = null
  capturedDeletedFlowsWhereIn = null
  capturedModifyCbs = []

  const flowsBuilder = {
    select: vi.fn().mockReturnThis(),
    whereNotNull: vi.fn().mockReturnThis(),
    whereNull: vi.fn().mockReturnThis(),
    whereRaw: vi.fn().mockReturnThis(),
  }

  const stepsBuilder: any = {
    select: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation((...args: any[]) => {
      if (args[0] === 'execution_steps.execution_id') {
        currentStepsExecutionId = args[1]
      }
      return stepsBuilder
    }),
    orderBy: vi.fn().mockImplementation(() => {
      const steps = stepsByExecutionId[currentStepsExecutionId ?? ''] ?? []
      return Promise.resolve(steps)
    }),
  }

  const execBuilder: any = {
    select: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockImplementation((table: string, col1: string, col2: string) => {
      capturedTestExecAntiJoin = { table, col1, col2 }
      return execBuilder
    }),
    where: vi.fn().mockImplementation((...args: any[]) => {
      if (typeof args[0] === 'function') {
        capturedEligibilityCb = args[0]
      }
      return execBuilder
    }),
    whereIn: vi.fn().mockImplementation((col: string, subquery: any) => {
      if (col === 'flow_id') {
        capturedDeletedFlowsWhereIn = subquery
      }
      return execBuilder
    }),
    whereNotIn: vi.fn().mockReturnThis(),
    whereNull: vi.fn().mockReturnThis(),
    modify: vi.fn().mockImplementation((cb: (qb: any) => void) => {
      capturedModifyCbs.push(cb)
      return execBuilder
    }),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi
      .fn()
      .mockImplementation(() => Promise.resolve(batches[batchIdx++] ?? [])),
  }

  const tableRouter = (table: string) => {
    if (table === 'flows') {
      return flowsBuilder
    }
    if (table === 'execution_steps') {
      return stepsBuilder
    }
    return execBuilder
  }
  ;(archivalDbReader as any).mockImplementation(tableRouter)
  ;(archivalDbReader as any).raw = vi
    .fn()
    .mockImplementation((expr: string) => expr)
  ;(archivalDb as any).mockImplementation(tableRouter)
}

describe('runArchivalLoop', () => {
  beforeEach(() => {
    vi.mocked(archiveExecution).mockResolvedValue('archived')
  })

  afterEach(() => {
    vi.clearAllMocks()
    ;(archivalConfig as any).archiveDeletedFlowsOnly = false
  })

  it('exits immediately when the first batch is empty', async () => {
    setupDb([[]])
    await runArchivalLoop(new AbortController().signal)
    expect(archiveExecution).not.toHaveBeenCalled()
  })

  it('calls archiveExecution for each execution in a batch', async () => {
    const batch = [makeExecution('e1'), makeExecution('e2')]
    setupDb([batch, []])

    await runArchivalLoop(new AbortController().signal)

    expect(archiveExecution).toHaveBeenCalledTimes(2)
    expect(archiveExecution).toHaveBeenCalledWith(
      batch[0],
      [],
      expect.objectContaining({ dryRun: false }),
    )
  })

  it('does not start a new batch after signal is aborted', async () => {
    const controller = new AbortController()
    // Use concurrency=1 so abort is observed before subsequent executions start
    ;(archivalConfig as any).archiveIntraBatchConcurrency = 1
    vi.mocked(archiveExecution).mockImplementation(async () => {
      controller.abort()
      return 'archived'
    })

    setupDb([
      [makeExecution('e1'), makeExecution('e2'), makeExecution('e3')],
      [makeExecution('e4')],
    ])

    await runArchivalLoop(controller.signal)

    // With concurrency=1: e1 runs and aborts; e2/e3 see signal.aborted before
    // calling archiveExecution. The second batch is never fetched.
    expect(archiveExecution).toHaveBeenCalledTimes(1)
  })

  it('continues processing remaining executions after one throws (allSettled)', async () => {
    vi.mocked(archiveExecution)
      .mockRejectedValueOnce(new Error('S3 timeout'))
      .mockResolvedValue('archived')

    setupDb([
      [makeExecution('e1'), makeExecution('e2'), makeExecution('e3')],
      [],
    ])

    await runArchivalLoop(new AbortController().signal)

    expect(archiveExecution).toHaveBeenCalledTimes(3)
  })

  it('advances cursor to the last batch item even when some executions fail', async () => {
    // All fail — cursor should still move to the last batch item
    vi.mocked(archiveExecution).mockRejectedValue(new Error('S3 error'))

    const batch = [
      makeExecution('00000000-0000-0000-0000-000000000001'),
      makeExecution('00000000-0000-0000-0000-000000000002'),
      makeExecution('00000000-0000-0000-0000-000000000003'),
    ]
    setupDb([batch, []])

    await runArchivalLoop(new AbortController().signal)

    // The second batch SELECT uses whereRaw(id > cursor); capturedModifyCbs[1] is the cursor modifier
    const qb = { whereRaw: vi.fn() }
    capturedModifyCbs[1](qb)
    expect(qb.whereRaw).toHaveBeenCalledWith('id > ?::uuid', [
      '00000000-0000-0000-0000-000000000003',
    ])
  })

  it('counts skipped executions when archiveExecution returns skipped', async () => {
    vi.mocked(archiveExecution).mockResolvedValue('skipped')
    setupDb([[makeExecution('e1')], []])

    // Should complete without throwing even when all executions are skipped
    await expect(
      runArchivalLoop(new AbortController().signal),
    ).resolves.toBeUndefined()
  })

  it('counts skipped executions when archiveExecution throws', async () => {
    vi.mocked(archiveExecution).mockRejectedValue(new Error('S3 timeout'))
    setupDb([[makeExecution('e1')], []])

    await expect(
      runArchivalLoop(new AbortController().signal),
    ).resolves.toBeUndefined()
  })

  describe('cutoff date', () => {
    function invokeActiveFlowBranch(branchIndex: 0 | 1): any[] {
      // The eligibility callback has three branches:
      //   where(deletedFlows), orWhere(nonTestActive), orWhere(testActive)
      // branchIndex 0 = nonTestActive (first orWhere), 1 = testActive (second orWhere)
      const whereCalls: any[][] = []
      const outerQb = {
        where: vi.fn().mockReturnThis(),
        orWhere: vi.fn().mockReturnThis(),
      }
      capturedEligibilityCb!(outerQb)

      const branchCb = outerQb.orWhere.mock.calls[branchIndex][0]
      const branchQb = {
        where: vi.fn().mockImplementation((...args: any[]) => {
          whereCalls.push(args)
          return branchQb
        }),
        whereIn: vi.fn().mockReturnThis(),
        whereNotIn: vi.fn().mockReturnThis(),
      }
      branchCb(branchQb)
      return whereCalls
    }

    it('uses strict less-than so active-flow executions exactly at the cutoff are not selected', async () => {
      setupDb([[]])
      await runArchivalLoop(new AbortController().signal)

      const whereCalls = invokeActiveFlowBranch(0)
      const cutoffCall = whereCalls.find((args) => args[0] === 'created_at')
      expect(cutoffCall).toBeDefined()
      expect(cutoffCall![1]).toBe('<')
    })

    it('sets the cutoff to retentionDays days before now', async () => {
      setupDb([[]])

      const before = new Date()
      before.setDate(before.getDate() - 90)

      await runArchivalLoop(new AbortController().signal)

      const after = new Date()
      after.setDate(after.getDate() - 90)

      const whereCalls = invokeActiveFlowBranch(0)
      const cutoffCall = whereCalls.find((args) => args[0] === 'created_at')
      const cutoff: Date = cutoffCall![2]
      expect(cutoff.getTime()).toBeGreaterThanOrEqual(before.getTime() - 100)
      expect(cutoff.getTime()).toBeLessThanOrEqual(after.getTime() + 100)
    })

    it('does not apply the cutoff to deleted-flow executions', async () => {
      setupDb([[]])
      await runArchivalLoop(new AbortController().signal)

      const outerQb = {
        where: vi.fn().mockReturnThis(),
        orWhere: vi.fn().mockReturnThis(),
      }
      capturedEligibilityCb!(outerQb)

      // The deleted-flows branch is the first .where() call
      const deletedFlowsCb = outerQb.where.mock.calls[0][0]
      const deletedFlowsQb = {
        where: vi.fn().mockReturnThis(),
        whereIn: vi.fn().mockReturnThis(),
      }
      deletedFlowsCb(deletedFlowsQb)

      expect(deletedFlowsQb.where).not.toHaveBeenCalledWith(
        'created_at',
        expect.anything(),
        expect.anything(),
      )
      expect(deletedFlowsQb.whereIn).toHaveBeenCalledWith(
        'flow_id',
        expect.anything(),
      )
    })
  })

  it('uses archivalDbReader for eligibility + execution_steps, archivalDb for the DELETE', async () => {
    const batch = [makeExecution('e1')]
    setupDb([batch, []])

    await runArchivalLoop(new AbortController().signal)

    // Reads use the replica
    expect(archivalDbReader).toHaveBeenCalledWith('executions')
    expect(archivalDbReader).toHaveBeenCalledWith('execution_steps')

    // DELETE transaction uses the writer (passed into archiveExecution)
    expect(archiveExecution).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ knexClient: archivalDb }),
    )
  })

  describe('archiveDeletedFlowsOnly', () => {
    it('uses the full three-branch eligibility query when flag is false', async () => {
      ;(archivalConfig as any).archiveDeletedFlowsOnly = false
      setupDb([[]])

      await runArchivalLoop(new AbortController().signal)

      expect(capturedEligibilityCb).not.toBeNull()
      expect(capturedDeletedFlowsWhereIn).toBeNull()
    })

    it('uses a simple whereIn(flow_id, deleted flows) query when flag is true', async () => {
      ;(archivalConfig as any).archiveDeletedFlowsOnly = true
      setupDb([[]])

      await runArchivalLoop(new AbortController().signal)

      // No three-branch WHERE — skipped entirely for the fast path
      expect(capturedEligibilityCb).toBeNull()
      expect(capturedDeletedFlowsWhereIn).not.toBeNull()
    })

    it('uses a subquery on flows.deleted_at for the filter', async () => {
      ;(archivalConfig as any).archiveDeletedFlowsOnly = true
      setupDb([[]])

      await runArchivalLoop(new AbortController().signal)

      expect(capturedDeletedFlowsWhereIn).not.toBeNull()
      expect(archivalDbReader).toHaveBeenCalledWith('flows')
    })
  })

  describe('eligibility WHERE clause', () => {
    it('has three branches: deleted-flows, non-test-active, test-active', async () => {
      setupDb([[]])
      await runArchivalLoop(new AbortController().signal)

      expect(capturedEligibilityCb).not.toBeNull()

      const outerQb = {
        where: vi.fn().mockReturnThis(),
        orWhere: vi.fn().mockReturnThis(),
      }
      capturedEligibilityCb!(outerQb)

      expect(outerQb.where).toHaveBeenCalledOnce()
      expect(outerQb.orWhere).toHaveBeenCalledTimes(2)
    })

    it('includes non-test executions on active flows with terminal statuses', async () => {
      setupDb([[]])
      await runArchivalLoop(new AbortController().signal)

      const outerQb = {
        where: vi.fn().mockReturnThis(),
        orWhere: vi.fn().mockReturnThis(),
      }
      capturedEligibilityCb!(outerQb)

      const nonTestActiveCb = outerQb.orWhere.mock.calls[0][0] as (
        qb: any,
      ) => void
      const nonTestActiveQb = {
        where: vi.fn().mockReturnThis(),
        whereIn: vi.fn().mockReturnThis(),
      }
      nonTestActiveCb(nonTestActiveQb)

      expect(nonTestActiveQb.where).toHaveBeenCalledWith('test_run', false)
      expect(nonTestActiveQb.whereIn).toHaveBeenCalledWith('status', [
        'success',
        'failure',
      ])
    })

    it('selects test executions on active flows by test_run + cutoff only', async () => {
      setupDb([[]])
      await runArchivalLoop(new AbortController().signal)

      const outerQb = {
        where: vi.fn().mockReturnThis(),
        orWhere: vi.fn().mockReturnThis(),
      }
      capturedEligibilityCb!(outerQb)

      const testActiveCb = outerQb.orWhere.mock.calls[1][0] as (qb: any) => void
      const testActiveQb = {
        where: vi.fn().mockReturnThis(),
        whereNotIn: vi.fn().mockReturnThis(),
      }
      testActiveCb(testActiveQb)

      expect(testActiveQb.where).toHaveBeenCalledWith('test_run', true)
      // test_execution_id protection is a global top-level guard, not per-branch
      expect(testActiveQb.whereNotIn).not.toHaveBeenCalled()
    })
  })

  describe('test_execution_id guard', () => {
    it('excludes flows.test_execution_id rows via LEFT JOIN anti-join at the top level', async () => {
      setupDb([[]])
      await runArchivalLoop(new AbortController().signal)

      expect(capturedTestExecAntiJoin).toEqual({
        table: 'flows as f_tex',
        col1: 'executions.id',
        col2: 'f_tex.test_execution_id',
      })
    })
  })

  describe('stepCounts', () => {
    it('accumulates counts per appKey:key from archived execution steps', async () => {
      const exec1 = makeExecution('e1')
      const exec2 = makeExecution('e2')
      setupDb([[exec1, exec2], []], {
        e1: [
          makeStep({
            id: 's1',
            executionId: 'e1',
            appKey: 'formsg',
            key: 'trigger',
          }),
          makeStep({
            id: 's2',
            executionId: 'e1',
            appKey: 'postman',
            key: 'send-sms',
          }),
        ],
        e2: [
          makeStep({
            id: 's3',
            executionId: 'e2',
            appKey: 'formsg',
            key: 'trigger',
          }),
        ],
      })

      await runArchivalLoop(new AbortController().signal)

      const metaCall = vi
        .mocked(putArchiveObject)
        .mock.calls.find(([args]) => args.key.startsWith('_meta/runs/'))
      expect(metaCall).toBeDefined()
      const payload = JSON.parse(metaCall![0].body as string)
      expect(payload.stepCounts).toEqual({
        formsg: { trigger: 2 },
        postman: { 'send-sms': 1 },
      })
    })

    it('increments nullStepCount for steps where appKey or key is null', async () => {
      const exec1 = makeExecution('e1')
      setupDb([[exec1], []], {
        e1: [
          makeStep({
            id: 's1',
            executionId: 'e1',
            appKey: null,
            key: 'trigger',
          }),
          makeStep({
            id: 's2',
            executionId: 'e1',
            appKey: 'formsg',
            key: null,
          }),
          makeStep({
            id: 's3',
            executionId: 'e1',
            appKey: 'formsg',
            key: 'trigger',
          }),
        ],
      })

      await runArchivalLoop(new AbortController().signal)

      const metaCall = vi
        .mocked(putArchiveObject)
        .mock.calls.find(([args]) => args.key.startsWith('_meta/runs/'))!
      const payload = JSON.parse(metaCall[0].body as string)
      expect(payload.nullStepCount).toBe(2)
      expect(payload.stepCounts).toEqual({ formsg: { trigger: 1 } })
    })

    it('does not count steps from skipped executions', async () => {
      vi.mocked(archiveExecution).mockResolvedValueOnce('skipped')
      const exec1 = makeExecution('e1')
      setupDb([[exec1], []], {
        e1: [
          makeStep({
            id: 's1',
            executionId: 'e1',
            appKey: 'formsg',
            key: 'trigger',
          }),
        ],
      })

      await runArchivalLoop(new AbortController().signal)

      const metaCall = vi
        .mocked(putArchiveObject)
        .mock.calls.find(([args]) => args.key.startsWith('_meta/runs/'))!
      const payload = JSON.parse(metaCall[0].body as string)
      expect(payload.stepCounts).toEqual({})
      expect(payload.nullStepCount).toBe(0)
    })

    it('writes meta file to _meta/runs/{runAt}.json with correct summary fields', async () => {
      const exec1 = makeExecution('e1')
      setupDb([[exec1], []], {
        e1: [
          makeStep({
            id: 's1',
            executionId: 'e1',
            appKey: 'formsg',
            key: 'trigger',
          }),
        ],
      })

      await runArchivalLoop(new AbortController().signal)

      const metaCall = vi
        .mocked(putArchiveObject)
        .mock.calls.find(([args]) => args.key.startsWith('_meta/runs/'))
      expect(metaCall).toBeDefined()
      expect(metaCall![0].key).toMatch(/^_meta\/runs\/.+\.json$/)
      expect(metaCall![0].contentType).toBe('application/json')

      const payload = JSON.parse(metaCall![0].body as string)
      expect(payload).toMatchObject({
        dryRun: false,
        executionsArchived: 1,
        executionsSkipped: 0,
        flowsAffected: 1,
      })
      expect(typeof payload.runAt).toBe('string')
      expect(typeof payload.durationMs).toBe('number')
    })
  })
})
