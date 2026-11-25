import { describe, expect, it } from 'vitest'

import { parseSchedulerPipesCheckConfig } from '../config'

describe('parseSchedulerPipesCheckConfig', () => {
  it('defaults the grace period to 900 seconds', () => {
    expect(parseSchedulerPipesCheckConfig({})).toEqual({
      missedRunGraceSeconds: 900,
    })
  })

  it.each(['0', '-1', 'abc'])('rejects a grace period of %s', (value) => {
    expect(() =>
      parseSchedulerPipesCheckConfig({
        SCHEDULE_MISSED_RUN_GRACE_SECONDS: value,
      }),
    ).toThrow()
  })
})
