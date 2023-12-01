import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'

import getDateTimeObjectRepresentation from '../../common/get-date-time-object'

describe('Test get date time object format', () => {
  describe('Test pretty_date', () => {
    it('Single digit date should be double padded', () => {
      const dateTime = DateTime.local(2023, 11, 1)
      expect(getDateTimeObjectRepresentation(dateTime).pretty_date).toEqual(
        '01 Nov 2023',
      )
    })

    it('Double digit date should not require extra padding', () => {
      const dateTime = DateTime.local(2023, 10, 21)
      expect(getDateTimeObjectRepresentation(dateTime).pretty_date).toEqual(
        '21 Oct 2023',
      )
    })
  })
})
