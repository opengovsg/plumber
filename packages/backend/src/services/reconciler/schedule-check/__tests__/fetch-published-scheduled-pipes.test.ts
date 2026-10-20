import '@/config/orm'
import { describe, expect, it } from 'vitest'

import { buildPublishedScheduledPipesQuery } from '../fetch-published-scheduled-pipes'

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
    expect(sql).toContain('"flow"."deleted_at" is null')
  })

  it('reads the trigger parameters and publish time', () => {
    expect(sql).toContain('"steps"."flow_id"')
    expect(sql).toContain('"steps"."parameters"')
    expect(sql).toContain('"flow"."published_at"')
  })
})
