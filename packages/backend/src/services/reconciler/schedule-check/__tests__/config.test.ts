import { describe, expect, it } from 'vitest'

import { parseScheduleCheckConfig } from '../config'

describe('parseScheduleCheckConfig', () => {
  it('defaults the check to minutes 18 and 42, away from scheduled pipe runs', () => {
    expect(parseScheduleCheckConfig({}).checkCronPattern).toBe('18,42 * * * *')
  })

  it('reads the check cron pattern from the environment', () => {
    expect(
      parseScheduleCheckConfig({
        RECONCILER_SCHEDULE_CHECK_CRON: '7 */2 * * *',
      }).checkCronPattern,
    ).toBe('7 */2 * * *')
  })

  it.each(['', 'abc', '61 * * * *'])(
    'rejects a check cron pattern of "%s"',
    (value) => {
      expect(() =>
        parseScheduleCheckConfig({ RECONCILER_SCHEDULE_CHECK_CRON: value }),
      ).toThrow()
    },
  )

  it.each(['0', '-1', 'abc'])('rejects a grace period of %s', (value) => {
    expect(() =>
      parseScheduleCheckConfig({ SCHEDULE_MISSED_RUN_GRACE_SECONDS: value }),
    ).toThrow()
  })
})
