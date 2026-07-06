import '@/types/luxon-extensions'

import { DateTime, Settings as LuxonSettings } from 'luxon'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
    it('throws an error if it cannot parse a date time string', () => {
      expect(() => parseDateTime('formsgSubmissionTime', 'derp')).toThrowError()
    })

    it('throws an error if trying to stringify an invalid date time', () => {
      expect(() =>
        dateTimeToString(
          'formsgSubmissionTime',
          DateTime.now().setZone('America/Blorp'),
        ),
      ).toThrowError()
    })

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

    it('supports parsing single-padded day input', () => {
      const dateTime = parseDateTime('formsgDateField', '5 Apr 2024')
      expect(dateTime.toUnixInteger()).toEqual(1712246400)
    })

    it('supports converting to FormSG date field, with time omitted', () => {
      const dateTime = DateTime.fromSeconds(1711986308)
      expect(dateTimeToString('formsgDateField', dateTime)).toEqual(
        '01 Apr 2024',
      )
    })

    it.each(['Sep', 'Sept'])(
      'supports parsing all September MMM shortforms',
      (mmm) => {
        const dateTime = parseDateTime('formsgDateField', `28 ${mmm} 2024`)
        expect(dateTime.toUnixInteger()).toEqual(1727452800)
      },
    )

    it('supports parsing MyInfo Child date field', () => {
      const dateTime = parseDateTime('dd/LL/yyyy', '25/03/2024')
      expect(dateTime.toUnixInteger()).toEqual(1711296000)
    })
  })

  describe('excelFormattedDate', () => {
    // EXCEL_EPOCH = 1899-12-30 (SG time). This corrects for Excel's phantom
    // Feb 29 1900 leap-year bug: serial 45292 = 2024-01-01T00:00:00+08:00.
    it('parses a known serial to the correct SG date (45292 = 2024-01-01)', () => {
      const dateTime = parseDateTime('excelFormattedDate', '45292')
      // 2024-01-01T00:00:00+08:00 = 2023-12-31T16:00:00Z
      expect(dateTime.toUnixInteger()).toEqual(1704038400)
    })

    it('converts fractional serials to time of day (0.5 = 12:00 noon)', () => {
      const dateTime = parseDateTime('excelFormattedDate', '45292.5')
      // 2024-01-01T12:00:00+08:00 = 2024-01-01T04:00:00Z
      expect(dateTime.toUnixInteger()).toEqual(1704081600)
    })

    it('trims whitespace from input', () => {
      const dateTime = parseDateTime('excelFormattedDate', '  45292  ')
      expect(dateTime.toUnixInteger()).toEqual(1704038400)
    })

    it.each(['0', '-1', 'abc', ''])('throws for invalid serial %s', (input) => {
      expect(() => parseDateTime('excelFormattedDate', input)).toThrowError()
    })

    it('stringify throws (input-only format)', () => {
      expect(() =>
        dateTimeToString('excelFormattedDate', DateTime.now()),
      ).toThrowError()
    })
  })

  describe('now', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(1718445600000) // 2024-06-15T10:00:00.000Z = 18:00 SG
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('ignores the input value and returns the current time in SG timezone', () => {
      expect(parseDateTime('now', 'ignored').toISO()).toEqual(
        '2024-06-15T18:00:00.000+08:00',
      )
    })

    it('stringify throws (input-only format)', () => {
      expect(() => dateTimeToString('now', DateTime.now())).toThrowError()
    })
  })
})
