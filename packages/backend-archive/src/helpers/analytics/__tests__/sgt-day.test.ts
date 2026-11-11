import { describe, expect, it } from 'vitest'

import { previousSgtDay, sgtDaysAfter, sgtDayWindow } from '../sgt-day'

describe('Singapore days', () => {
  it('maps a day to its UTC window', () => {
    expect(sgtDayWindow('2026-11-05')).toEqual({
      start: new Date('2026-11-04T16:00:00.000Z'),
      end: new Date('2026-11-05T16:00:00.000Z'),
    })
  })

  it('takes yesterday in Singapore, not in UTC', () => {
    // 01:30 on 7 Nov in Singapore is still 6 Nov in UTC.
    expect(previousSgtDay(new Date('2026-11-06T17:30:00.000Z'))).toBe(
      '2026-11-06',
    )
  })

  it('lists the days after one day through another', () => {
    expect(sgtDaysAfter('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ])
    expect(sgtDaysAfter('2026-11-02', '2026-11-02')).toEqual([])
  })
})
