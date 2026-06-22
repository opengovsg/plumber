import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./config', () => ({
  archivalConfig: {
    archiveDryRun: false,
    archiveRetentionDays: 90,
    archiveBatchSize: 500,
    archiveBatchSleepMs: 0,
    archiveBucket: 'archive-bucket',
    archiveDeletedFlowsOnly: false,
  },
}))
vi.mock('./logger')
vi.mock('./s3-client', () => ({ archiveS3Client: {} }))
vi.mock('./archive-execution')
vi.mock('./db', () => ({
  archivalDb: vi.fn(),
  archivalDbReader: vi.fn(),
}))

import { archiveExecution } from './archive-execution'
import { archivalConfig } from './config'
import { archivalDb, archivalDbReader } from './db'
import { runArchivalLoop } from './run-archival-loop'
import type { ExecutionRow } from './types'

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

// Callbacks captured from the executions query builder during each test run
let capturedEligibilityCb: ((qb: any) => void) | null = null
let capturedTestExecExclusionSubquery: any = null
let capturedModifyCbs: Array<(qb: any) => void> = []

function setupDb(batches: ExecutionRow[][]) {
  let batchIdx = 0
  capturedEligibilityCb = null
  capturedTestExecExclusionSubquery = null
  capturedModifyCbs = []

  const flowsBuilder = {
    select: vi.fn().mockReturnThis(),
    whereNotNull: vi.fn().mockReturnThis(),
    whereNull: vi.fn().mockReturnThis(),
  }

  const stepsBuilder = {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
  }

  const execBuilder: any = {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation((...args: any[]) => {
      if (typeof args[0] === 'function') {
        capturedEligibilityCb = args[0]
      }
      return execBuilder
    }),
    whereNotIn: vi.fn().mockImplementation((_col: string, subquery: any) => {
      capturedTestExecExclusionSubquery = subquery
      return execBuilder
    }),
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
  ;(archivalDb as any).mockImplementation(tableRouter)
}

describe('runArchivalLoop', () => {
  beforeEach(() => {
    vi.mocked(archiveExecution).mockResolvedValue('archived')
  })

  afterEach(() => {
    vi.clearAllMocks()
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

  it('stops processing mid-batch when signal is aborted', async () => {
    const controller = new AbortController()
    vi.mocked(archiveExecution).mockImplementation(async () => {
      controller.abort()
      return 'archived'
    })

    setupDb([
      [makeExecution('e1'), makeExecution('e2'), makeExecution('e3')],
      [],
    ])

    await runArchivalLoop(controller.signal)

    expect(archiveExecution).toHaveBeenCalledTimes(1)
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
    it('does not add a flow_id filter when flag is false', async () => {
      ;(archivalConfig as any).archiveDeletedFlowsOnly = false
      setupDb([[]])

      await runArchivalLoop(new AbortController().signal)

      // capturedModifyCbs[0] is the deleted-flows modifier; invoke it with a spy qb
      const qb = { whereIn: vi.fn() }
      capturedModifyCbs[0](qb)
      expect(qb.whereIn).not.toHaveBeenCalled()
    })

    it('restricts to deleted flows when flag is true', async () => {
      ;(archivalConfig as any).archiveDeletedFlowsOnly = true
      setupDb([[]])

      await runArchivalLoop(new AbortController().signal)

      const qb = { whereIn: vi.fn() }
      capturedModifyCbs[0](qb)
      expect(qb.whereIn).toHaveBeenCalledWith('flow_id', expect.anything())
    })

    it('uses a subquery on flows.deleted_at for the filter', async () => {
      ;(archivalConfig as any).archiveDeletedFlowsOnly = true
      setupDb([[]])

      await runArchivalLoop(new AbortController().signal)

      const qb = { whereIn: vi.fn() }
      capturedModifyCbs[0](qb)

      // The subquery should be archivalDbReader('flows').select('id').whereNotNull('deleted_at')
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
    it('excludes flows.test_execution_id rows for all flows at the top level', async () => {
      setupDb([[]])
      await runArchivalLoop(new AbortController().signal)

      expect(capturedTestExecExclusionSubquery).not.toBeNull()
      // Subquery must use archivalDbReader('flows') — verified by the mock
      expect(archivalDbReader).toHaveBeenCalledWith('flows')
    })
  })
})
