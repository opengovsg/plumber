import { describe, expect, it } from 'vitest'

import { parseScheduleCheckConfig } from '../config'

describe('parseScheduleCheckConfig', () => {
  it('defaults the check interval to 300 seconds', () => {
    expect(parseScheduleCheckConfig({}).checkIntervalSeconds).toBe(300)
  })

  it('reads the check interval from the environment without an upper cap', () => {
    expect(
      parseScheduleCheckConfig({
        RECONCILER_SCHEDULE_CHECK_INTERVAL_SECONDS: '86400',
      }).checkIntervalSeconds,
    ).toBe(86400)
  })

  it.each(['0', '-1', '1.5', 'abc'])(
    'rejects a check interval of %s',
    (value) => {
      expect(() =>
        parseScheduleCheckConfig({
          RECONCILER_SCHEDULE_CHECK_INTERVAL_SECONDS: value,
        }),
      ).toThrow()
    },
  )

  it.each(['0', '-1', 'abc'])('rejects a grace period of %s', (value) => {
    expect(() =>
      parseScheduleCheckConfig({ SCHEDULE_MISSED_RUN_GRACE_SECONDS: value }),
    ).toThrow()
  })
})
