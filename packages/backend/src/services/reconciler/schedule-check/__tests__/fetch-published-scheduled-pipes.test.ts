import { describe, expect, it } from 'vitest'

import schedulerApp from '@/apps/scheduler'

import { buildPublishedScheduledPipesQuery } from '../fetch-published-scheduled-pipes'

describe('buildPublishedScheduledPipesQuery', () => {
  const { sql, bindings } = buildPublishedScheduledPipesQuery().toSQL()

  it('selects published pipes with a scheduler trigger', () => {
    expect(sql).toContain('"flows"."active" = ?')
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

  it('reads the trigger parameters and publish time', () => {
    expect(sql).toContain('"steps"."flow_id"')
    expect(sql).toContain('"steps"."parameters"')
    expect(sql).toContain('"flows"."published_at"')
  })

  // The Step model would transform the parameters on read, and this raw query does not.
  it('reads scheduler parameters that need no transform', () => {
    expect(schedulerApp.stepTransformer).toBeUndefined()
  })
})
