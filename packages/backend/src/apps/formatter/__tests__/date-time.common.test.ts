import { DateTime, Settings as LuxonSettings } from 'luxon'
import { describe, expect, it } from 'vitest'

import {
  dateTimeToString,
  parseDateTime,
} from '../actions/date-time/common/date-time-format'

// TZ formatting replicated here (see appConfig) as tests don't load the app
// config module.
LuxonSettings.defaultZone = 'Asia/Singapore'
LuxonSettings.defaultLocale = 'en-SG'

describe('common date-time formatter functions', () => {
  describe('date-time formats', () => {
    describe('formsg submission time', () => {
      it('supports parsing FormSG submission time / ISO 8601', () => {
        const dateTime = parseDateTime(
          'formsgSubmissionTime',
          '2024-03-26T10:45:50.584+08:00',
        )
        expect(dateTime.toUnixInteger()).toEqual(1711421150)
      })

      it('supports converting to FormSG submission time / ISO 8601', () => {
        const dateTime = DateTime.fromSeconds(1711986308)
        expect(dateTimeToString('formsgSubmissionTime', dateTime)).toEqual(
          '2024-04-01T23:45:08.000+08:00',
        )
      })
    })
  })

  describe('formsg date field', () => {
    it('supports parsing FormSG date field, with time defaulted to midnight', () => {
      const dateTime = parseDateTime('formsgDateField', '28 Mar 2024')
      expect(dateTime.toUnixInteger()).toEqual(1711555200)
    })

    it('supports converting to FormSG date field, with time omitted', () => {
      const dateTime = DateTime.fromSeconds(1711986308)
      expect(dateTimeToString('formsgDateField', dateTime)).toEqual(
        '01 Apr 2024',
      )
    })
  })
})
