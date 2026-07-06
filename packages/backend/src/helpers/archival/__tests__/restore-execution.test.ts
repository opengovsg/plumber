import type { Knex } from 'knex'
import { describe, expect, it, vi } from 'vitest'

import { restoreExecution } from '../restore-execution'
import type { ArchivedPayload } from '../types'

const mockPayload: ArchivedPayload = {
  execution: {
    id: 'exec-1',
    flowId: 'flow-1',
    status: 'success',
    testRun: false,
    internalId: null,
    createdAt: '2025-01-15T00:00:00.000Z',
    updatedAt: '2025-01-15T00:00:00.000Z',
    deletedAt: null,
  },
  steps: [
    {
      id: 'step-1',
      executionId: 'exec-1',
      stepId: 'step-def-1',
      appKey: 'formsg',
      key: 'trigger',
      jobId: null,
      status: 'success',
      dataIn: { foo: 'bar' },
      dataOut: { result: 'ok' },
      errorDetails: null,
      metadata: {},
      createdAt: '2025-01-15T00:00:01.000Z',
      updatedAt: '2025-01-15T00:00:01.000Z',
      deletedAt: null,
    },
  ],
}

function makeInsertChain(returning: object[]) {
  return {
    onConflict: vi.fn().mockReturnThis(),
    ignore: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returning),
  }
}

function makeMockKnex({ executionExists = false, stepExists = false } = {}) {
  const rawFn = vi.fn().mockResolvedValue([])

  const execChain = makeInsertChain(executionExists ? [] : [{ id: 'exec-1' }])
  const stepChain = makeInsertChain(stepExists ? [] : [{ id: 'step-1' }])

  const insertExecFn = vi.fn().mockReturnValue(execChain)
  const insertStepFn = vi.fn().mockReturnValue(stepChain)

  const trx = (table: string) => ({
    insert: table === 'executions' ? insertExecFn : insertStepFn,
  })
  const trxWithRaw = Object.assign(trx, { raw: rawFn })

  const knexClient = {
    transaction: vi.fn(async (cb: (trx: unknown) => Promise<void>) =>
      cb(trxWithRaw),
    ),
    _insertExecFn: insertExecFn,
    _insertStepFn: insertStepFn,
    _rawFn: rawFn,
  } as unknown as Knex & {
    _insertExecFn: ReturnType<typeof vi.fn>
    _insertStepFn: ReturnType<typeof vi.fn>
    _rawFn: ReturnType<typeof vi.fn>
  }
  return knexClient
}

describe('restoreExecution', () => {
  it('inserts execution and steps when neither exist', async () => {
    const knex = makeMockKnex()
    const result = await restoreExecution(mockPayload, knex)
    expect(result.executionInserted).toBe(true)
    expect(result.stepsInserted).toBe(1)
    expect((knex as any)._insertExecFn).toHaveBeenCalledOnce()
    expect((knex as any)._insertStepFn).toHaveBeenCalledOnce()
  })

  it('reports executionInserted=false when execution already exists', async () => {
    const knex = makeMockKnex({ executionExists: true })
    const result = await restoreExecution(mockPayload, knex)
    expect(result.executionInserted).toBe(false)
    expect((knex as any)._insertExecFn).toHaveBeenCalledOnce()
  })

  it('reports stepsInserted=0 when steps already exist', async () => {
    const knex = makeMockKnex({ stepExists: true })
    const result = await restoreExecution(mockPayload, knex)
    expect(result.stepsInserted).toBe(0)
    expect((knex as any)._insertStepFn).toHaveBeenCalledOnce()
  })

  it('runs inside a transaction', async () => {
    const knex = makeMockKnex()
    await restoreExecution(mockPayload, knex)
    expect(knex.transaction).toHaveBeenCalledOnce()
  })

  it('sets archiveDisabled on the flow config before restoring', async () => {
    const knex = makeMockKnex()
    await restoreExecution(mockPayload, knex)
    const rawCall = (knex as any)._rawFn.mock.calls[0]
    expect(rawCall[0]).toContain('UPDATE flows')
    expect(rawCall[1][0]).toBe(JSON.stringify({ archiveDisabled: true }))
    expect(rawCall[1][1]).toBe('flow-1')
    expect((knex as any)._rawFn).toHaveBeenCalledBefore(
      (knex as any)._insertExecFn,
    )
  })

  it('handles empty steps array', async () => {
    const knex = makeMockKnex()
    const result = await restoreExecution({ ...mockPayload, steps: [] }, knex)
    expect(result.stepsInserted).toBe(0)
    expect((knex as any)._insertStepFn).not.toHaveBeenCalled()
  })
})
