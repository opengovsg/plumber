import type { IExecutionStep } from '@plumber/types'

import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'

import getDataOutMetadata from '../actions/compare-calculate/get-data-out-metadata'
import {
  computeComparison,
  computeDifference,
  computeGap,
  parseOperand,
} from '../actions/compare-calculate/logic'

const SG = 'Asia/Singapore'
const sg = (iso: string): DateTime => DateTime.fromISO(iso, { zone: SG })

describe('compare-calculate prototype', () => {
  describe('parseOperand', () => {
    it('converts an Excel serial number to a SG date', () => {
      // 45292 is 1 Jan 2024 in Excel's 1900 date system.
      const result = parseOperand('excelFormattedDate', '45292')
      expect(result.zoneName).toBe(SG)
      expect(result.toFormat('yyyy-LL-dd')).toBe('2024-01-01')
    })

    it('reads the fractional part of an Excel serial as the time of day', () => {
      const result = parseOperand('excelFormattedDate', '45292.5')
      expect(result.toFormat('yyyy-LL-dd HH:mm')).toBe('2024-01-01 12:00')
    })

    it('rejects non-positive / non-numeric Excel serials', () => {
      expect(() => parseOperand('excelFormattedDate', '0')).toThrow()
      expect(() => parseOperand('excelFormattedDate', '-5')).toThrow()
      expect(() => parseOperand('excelFormattedDate', 'abc')).toThrow()
    })

    it('parses zoneless formats as SG wall-clock time', () => {
      const result = parseOperand('dd/LL/yyyy', '25/03/2024')
      expect(result.zoneName).toBe(SG)
      expect(result.toFormat('yyyy-LL-dd')).toBe('2024-03-25')
    })

    it('"now" ignores the value and returns the current SG time', () => {
      const result = parseOperand('now', '')
      expect(result.zoneName).toBe(SG)
      expect(Math.abs(result.diffNow().as('seconds'))).toBeLessThan(5)
    })

    it('parses a FormSG date field for historical dates', () => {
      const result = parseOperand('formsgDateField', '18 Jul 1908')
      expect(result.isValid).toBe(true)
      expect(result.zoneName).toBe(SG)
      expect(result.toFormat('yyyy-LL-dd')).toBe('1908-07-18')
    })
  })

  describe('computeComparison', () => {
    const a = sg('2024-03-25T09:00')
    const b = sg('2024-04-01T09:00')

    it('before / after', () => {
      expect(computeComparison(a, 'before', b).result).toBe('true')
      expect(computeComparison(a, 'after', b).result).toBe('false')
    })

    it('same day ignores the time component', () => {
      const morning = sg('2024-03-25T08:00')
      const evening = sg('2024-03-25T20:00')
      expect(computeComparison(morning, 'sameDay', evening).result).toBe('true')
    })
  })

  describe('computeGap', () => {
    it('"within 2 weeks" is true when the dates are 7 days apart', () => {
      const submission = sg('2024-03-25')
      const event = sg('2024-04-01')
      expect(computeGap(submission, 'within', 2, 'weeks', event).result).toBe(
        'true',
      )
    })

    it('"more than 3 months after" reflects direction', () => {
      const now = sg('2024-06-01')
      const lastUpdate = sg('2024-01-01')
      // now is ~5 months after lastUpdate -> true
      expect(computeGap(now, 'moreAfter', 3, 'months', lastUpdate).result).toBe(
        'true',
      )
      // now is not more than 3 months *before* lastUpdate -> false
      expect(
        computeGap(now, 'moreBefore', 3, 'months', lastUpdate).result,
      ).toBe('false')
    })
  })

  describe('computeDifference', () => {
    it('returns a signed whole number from the first date to the second', () => {
      const submission = sg('2024-03-25')
      const today = sg('2024-04-04')
      const diff = computeDifference(submission, today, 'days')
      expect(diff.result).toBe(10)
      expect(diff.absolute).toBe(10)
      expect(diff.unit).toBe('days')
    })

    it('is negative when the second date is earlier', () => {
      const today = sg('2024-04-04')
      const submission = sg('2024-03-25')
      const diff = computeDifference(today, submission, 'days')
      expect(diff.result).toBe(-10)
      expect(diff.absolute).toBe(10)
    })
  })

  describe('getDataOutMetadata (variable picker labels)', () => {
    const fakeStep = (dataOut: Record<string, unknown>) =>
      ({ dataOut } as unknown as IExecutionStep)

    it('labels the boolean output for compare / gap', async () => {
      const meta = await getDataOutMetadata(fakeStep({ result: 'true' }))
      expect(meta?.result).toMatchObject({ label: 'Answer (true / false)' })
    })

    it('labels the numeric outputs for calculate', async () => {
      const meta = await getDataOutMetadata(
        fakeStep({ result: 10, absolute: 10, unit: 'days' }),
      )
      expect(meta?.absolute).toMatchObject({
        label: 'Time difference (always positive)',
      })
      expect(meta?.unit).toMatchObject({ label: 'Unit (e.g. days, weeks)' })
    })
  })
})
