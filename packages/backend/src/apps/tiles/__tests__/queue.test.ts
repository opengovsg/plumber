// Avoid cyclic imports when importing m365ExcelApp
import '@/apps'
import type { IGlobalVariable } from '@plumber/types'
import { afterEach, describe, expect, it, vi } from 'vitest'

import tilesApp from '..'

const mocks = vi.hoisted(() => ({
  stepQueryResult: vi.fn(),
  tableFindById: vi.fn(),
}))

vi.mock('@/models/table-metadata', () => ({
  default: {
    query: vi.fn(() => ({
      findById: mocks.tableFindById,
    })),
  },
}))

vi.mock('@/models/step', () => ({
  default: {
    query: vi.fn(() => ({
      findById: vi.fn(() => ({
        throwIfNotFound: mocks.stepQueryResult,
      })),
    })),
  },
}))

describe('Queue config', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('sets group ID to the file ID', async () => {
    mocks.stepQueryResult.mockResolvedValueOnce({
      parameters: {
        tableId: 'mock-table-id',
      },
      key: 'findSingleRow',
      appKey: 'tiles',
    })
    const groupConfig = await tilesApp.queue.getGroupConfigForJob({
      flowId: 'test-flow-id',
      stepId: 'test-step-id',
      executionId: 'test-step-id',
    })
    expect(groupConfig).toEqual({
      id: 'mock-table-id-findSingleRow',
    })
  })

  it('sets group ID to null', async () => {
    mocks.stepQueryResult.mockResolvedValueOnce({
      parameters: {
        tableId: 'mock-table-id',
      },
      key: 'createRow',
      appKey: 'tiles',
    })
    const groupConfig = await tilesApp.queue.getGroupConfigForJob({
      flowId: 'test-flow-id',
      stepId: 'test-step-id',
      executionId: 'test-step-id',
    })
    expect(groupConfig).toEqual(null)
  })

  it('sets group concurrency to 1', () => {
    expect(tilesApp.queue.groupLimits).toEqual({
      type: 'concurrency',
      concurrency: 1,
    })
  })

  describe('getRequeueDelayMs', () => {
    const makeGlobalVariable = (key: string) =>
      ({
        step: { key, parameters: { tableId: 'mock-table-id' } },
      }) as unknown as IGlobalVariable

    it.each(['createTileRow', 'updateSingleRow'])(
      'returns a 60 to 90 s delay for %s on a frozen tile',
      async (key) => {
        mocks.tableFindById.mockResolvedValueOnce({
          db: 'ddb',
          migrationStartedAt: new Date(),
        })
        const delay = await tilesApp.queue.getRequeueDelayMs(
          makeGlobalVariable(key),
        )
        expect(delay).toBeGreaterThanOrEqual(60_000)
        expect(delay).toBeLessThan(90_000)
      },
    )

    it.each(['findSingleRow', 'findMultipleRows'])(
      'returns null for %s without loading the tile',
      async (key) => {
        await expect(
          tilesApp.queue.getRequeueDelayMs(makeGlobalVariable(key)),
        ).resolves.toBeNull()
        expect(mocks.tableFindById).not.toHaveBeenCalled()
      },
    )

    it.each([
      ['not frozen', { db: 'ddb', migrationStartedAt: null }],
      [
        'past the lease',
        { db: 'ddb', migrationStartedAt: new Date(Date.now() - 31 * 60_000) },
      ],
      ['already on Postgres', { db: 'pg', migrationStartedAt: new Date() }],
      ['deleted', undefined],
    ])('returns null when the tile is %s', async (_label, table) => {
      mocks.tableFindById.mockResolvedValueOnce(table)
      await expect(
        tilesApp.queue.getRequeueDelayMs(makeGlobalVariable('createTileRow')),
      ).resolves.toBeNull()
    })
  })
})
