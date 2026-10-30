import { describe, expect, it } from 'vitest'

import { parseScheduleCheckConfig } from '../config'

describe('parseScheduleCheckConfig', () => {
  it('defaults the grace period to 900 seconds', () => {
    expect(parseScheduleCheckConfig({})).toEqual({ missedRunGraceSeconds: 900 })
  })

  it.each(['0', '-1', 'abc'])('rejects a grace period of %s', (value) => {
    expect(() =>
      parseScheduleCheckConfig({ SCHEDULE_MISSED_RUN_GRACE_SECONDS: value }),
    ).toThrow()
  })
})
