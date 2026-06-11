import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./config', () => ({
  archivalConfig: {
    archiveDryRun: false,
    archiveRetentionDays: 90,
    archiveBatchSize: 500,
    archiveBatchSleepMs: 0,
    archiveBucket: 'archive-bucket',
  },
}))
vi.mock('./logger')
vi.mock('./s3-client', () => ({ archiveS3Client: {} }))
vi.mock('./archive-execution')
vi.mock('./db', () => ({ archivalDb: vi.fn() }))

import { archiveExecution } from './archive-execution'
import { archivalDb } from './db'
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
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
    ...overrides,
  }
}

// Callbacks captured from the executions query builder during each test run
let capturedEligibilityCb: ((qb: any) => void) | null = null
let capturedWhereCalls: Array<any[]> = []
let capturedModifyCbs: Array<(qb: any) => void> = []

function setupDb(batches: ExecutionRow[][]) {
  let batchIdx = 0
  capturedEligibilityCb = null
  capturedWhereCalls = []
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
      } else {
        capturedWhereCalls.push(args)
      }
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

  ;(archivalDb as any).mockImplementation((table: string) => {
    if (table === 'flows') {
      return flowsBuilder
    }
    if (table === 'execution_steps') {
      return stepsBuilder
    }
    return execBuilder
  })
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
    it('uses strict less-than so executions exactly at the cutoff are not selected', async () => {
      setupDb([[]])
      await runArchivalLoop(new AbortController().signal)

      const cutoffCall = capturedWhereCalls.find(
        (args) => args[0] === 'created_at',
      )
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

      const cutoffCall = capturedWhereCalls.find(
        (args) => args[0] === 'created_at',
      )
      const cutoff: Date = cutoffCall![2]
      expect(cutoff.getTime()).toBeGreaterThanOrEqual(before.getTime() - 100)
      expect(cutoff.getTime()).toBeLessThanOrEqual(after.getTime() + 100)
    })
  })

  describe('eligibility WHERE clause', () => {
    it('includes non-test executions with terminal statuses', async () => {
      setupDb([[]])
      await runArchivalLoop(new AbortController().signal)

      expect(capturedEligibilityCb).not.toBeNull()

      const outerQb = {
        where: vi.fn().mockReturnThis(),
        orWhere: vi.fn().mockReturnThis(),
      }
      capturedEligibilityCb!(outerQb)

      expect(outerQb.where).toHaveBeenCalledOnce()

      const nonTestCb = outerQb.where.mock.calls[0][0] as (qb: any) => void

      // The non-test branch is: b.where('test_run', false).where((c) => c.whereIn(...).orWhereIn(...))
      // The inner callback needs to be invoked to observe whereIn calls.
      const innerQb = {
        whereIn: vi.fn().mockReturnThis(),
        orWhereIn: vi.fn().mockReturnThis(),
      }
      const nonTestQb = {
        where: vi.fn().mockImplementation((...args: any[]) => {
          if (typeof args[0] === 'function') {
            args[0](innerQb)
          }
          return nonTestQb
        }),
        whereIn: vi.fn().mockReturnThis(),
      }
      nonTestCb(nonTestQb)

      expect(nonTestQb.where).toHaveBeenCalledWith('test_run', false)
      expect(innerQb.whereIn).toHaveBeenCalledWith('status', [
        'success',
        'failure',
      ])
    })

    it('excludes test executions that are still referenced by flows.test_execution_id', async () => {
      setupDb([[]])
      await runArchivalLoop(new AbortController().signal)

      expect(capturedEligibilityCb).not.toBeNull()

      const outerQb = {
        where: vi.fn().mockReturnThis(),
        orWhere: vi.fn().mockReturnThis(),
      }
      capturedEligibilityCb!(outerQb)

      expect(outerQb.orWhere).toHaveBeenCalledOnce()

      const testRunCb = outerQb.orWhere.mock.calls[0][0] as (qb: any) => void
      const testRunQb = {
        where: vi.fn().mockReturnThis(),
        whereNotIn: vi.fn().mockReturnThis(),
      }
      testRunCb(testRunQb)

      expect(testRunQb.where).toHaveBeenCalledWith('test_run', true)
      // whereNotIn (not whereIn) ensures live test executions are excluded
      expect(testRunQb.whereNotIn).toHaveBeenCalledWith('id', expect.anything())
    })
  })
})
