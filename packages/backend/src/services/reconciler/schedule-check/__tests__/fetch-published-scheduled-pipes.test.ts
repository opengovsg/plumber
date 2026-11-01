import '@/config/orm'
import { describe, expect, it, vi } from 'vitest'

import {
  buildPublishedScheduledPipesQuery,
  type PublishedScheduledPipeRow,
  toPublishedScheduledPipe,
} from '../fetch-published-scheduled-pipes'

describe('buildPublishedScheduledPipesQuery', () => {
  const { sql, bindings } = buildPublishedScheduledPipesQuery()
    .toKnexQuery()
    .toSQL()

  it('selects published pipes with a scheduler trigger', () => {
    expect(sql).toContain('"flow"."active" = ?')
    expect(sql).toContain('"steps"."type" = ?')
    expect(sql).toContain('"steps"."app_key" = ?')
    expect(sql).toContain('"steps"."key" in (?, ?, ?, ?)')
    expect(bindings).toEqual(
      expect.arrayContaining([
        true,
        'trigger',
        'scheduler',
        'everyHour',
        'everyDay',
        'everyWeek',
        'everyMonth',
      ]),
    )
  })

  it('skips soft-deleted steps and pipes', () => {
    expect(sql).toContain('"steps"."deleted_at" is null')
    expect(sql).toContain('"flows"."deleted_at" is null')
  })
})

describe('toPublishedScheduledPipe', () => {
  const row: PublishedScheduledPipeRow = {
    flowId: 'flow-1',
    key: 'everyDay',
    parameters: { hour: 9 },
    version: 1,
    publishedAt: '2026-01-01T00:00:00.000Z',
  }

  it('returns the stored parameters when the scheduler has no transformer', () => {
    expect(toPublishedScheduledPipe(row, undefined)).toEqual({
      flowId: 'flow-1',
      publishedAt: '2026-01-01T00:00:00.000Z',
      triggerKey: 'everyDay',
      triggerParameters: { hour: 9 },
    })
  })

  it('applies the scheduler step transformer like Step does on read', () => {
    const transformStepParameters = vi.fn().mockReturnValue({ hour: 10 })

    const pipe = toPublishedScheduledPipe(row, {
      transformStepParameters,
      getLatestStepVersion: () => 2,
    })

    expect(transformStepParameters).toHaveBeenCalledWith(
      'everyDay',
      { hour: 9 },
      1,
    )
    expect(pipe.triggerParameters).toEqual({ hour: 10 })
  })
})
