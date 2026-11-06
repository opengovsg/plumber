import { describe, expect, it } from 'vitest'

import { detectDateFormat } from '../detectDateFormat'

describe('detectDateFormat', () => {
  it.each([
    ['2024-03-25T08:15:30.250+08:00', 'formsgSubmissionTime'],
    ['2024-03-25T08:15:30+08:00', 'formsgSubmissionTime'],
    ['25 Mar 2024', 'formsgDateField'],
    ['5 Apr 2024', 'formsgDateField'],
    ['25 March 2024', 'dd LLLL yyyy'],
    ['25/03/2024', 'dd/LL/yyyy'],
    ['25/03/24', 'dd/LL/yy'],
    ['2024/03/25', 'yyyy/LL/dd'],
    ['2024-03-25', 'yyyy-LL-dd'],
    ['12:04 PM', 'hh:mm a'],
    ['12:04:05 pm', 'hh:mm:ss a'],
    ['13:04', 'HH:mm'],
    ['25 Mar 2024 12:04 pm', 'dd LLL yyyy hh:mm a'],
    ['25 Mar 2024 12:04:05 pm', 'dd LLL yyyy hh:mm:ss a'],
    ['45292', 'excelFormattedDate'],
    ['45292.5', 'excelFormattedDate'],
  ])('detects %s as %s', (sample, expected) => {
    expect(detectDateFormat(sample)).toBe(expected)
  })

  it.each(['', '   ', 'hello', '2024', '31/02/2024', '{{step.x.y}}'])(
    'returns undefined for %j',
    (sample) => {
      expect(detectDateFormat(sample)).toBeUndefined()
    },
  )
})
