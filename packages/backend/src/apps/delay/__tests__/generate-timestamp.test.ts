import { describe, expect, it } from 'vitest'

import generateTimestamp from '../helpers/generate-timestamp'

const DEFAULT_TIME = '00:00'
const VALID_TIME = '12:00'
const INVALID_TIME_1 = '25:00'
const INVALID_TIME_2 = '00:60'

/** formats to allow for date time
1. yyyy-MM-dd HH:mm - ISO Complete Date format
2. dd MMM yyyy HH:mm - long date format
3. dd/MM/yyyy HH:mm - short date format 
*/

describe('delay until date and time handler', () => {
  describe('1. ISO Complete Date format', () => {
    it('[Valid] ISO Complete Date format (empty time)', () => {
      const date = '2023-09-05'
      const time = DEFAULT_TIME
      expect(generateTimestamp(date, time)).toBeTruthy()
    })

    it('[Valid] ISO Complete Date format (with time)', () => {
      const date = '2023-09-05'
      const time = VALID_TIME
      expect(generateTimestamp(date, time)).toBeTruthy()
    })

    it('[Invalid] ISO DateTime format', () => {
      const date = '2023-09-05T12:00:00.000Z'
      const time = DEFAULT_TIME
      expect(generateTimestamp(date, time)).toBeFalsy()
    })

    it('[Invalid] Wrong time format', () => {
      const date = '2023-09-05'
      const time = INVALID_TIME_1
      expect(generateTimestamp(date, time)).toBeFalsy()
    })

    it('[Invalid] Wrong format order 1', () => {
      const date = '09-05-2023'
      const time = DEFAULT_TIME
      expect(generateTimestamp(date, time)).toBeFalsy()
    })

    it('[Invalid] Wrong format order 2', () => {
      const date = '05-09-2023'
      const time = DEFAULT_TIME
      expect(generateTimestamp(date, time)).toBeFalsy()
    })

    it('[Invalid] Wrong year format', () => {
      const date = '05-09-23'
      const time = DEFAULT_TIME
      expect(generateTimestamp(date, time)).toBeFalsy()
    })
  })

  describe('2. Short date format', () => {
    it('[Valid]: Short date format (empty time)', () => {
      const date = '05/09/2023'
      const time = DEFAULT_TIME
      expect(generateTimestamp(date, time)).toBeTruthy()
    })

    it('[Valid]: Short date format (with time)', () => {
      const date = '05/09/2023'
      const time = VALID_TIME
      expect(generateTimestamp(date, time)).toBeTruthy()
    })

    it('[Invalid]: Wrong year', () => {
      const date = '05/09/20234'
      const time = DEFAULT_TIME
      expect(generateTimestamp(date, time)).toBeFalsy()
    })

    it('[Invalid]: Wrong month', () => {
      const date = '05/13/2023'
      const time = DEFAULT_TIME
      expect(generateTimestamp(date, time)).toBeFalsy()
    })

    it('[Invalid]: Wrong format', () => {
      const date = '05/09/2023 ??'
      const time = DEFAULT_TIME
      expect(generateTimestamp(date, time)).toBeFalsy()
    })
  })

  describe('3. Long date format', () => {
    it('[Valid]: Long date format (empty time)', () => {
      const date = '05 Sep 2023'
      const time = DEFAULT_TIME
      expect(generateTimestamp(date, time)).toBeTruthy()
    })

    it('[Valid]: Long date format (with time)', () => {
      const date = '05 Sep 2023'
      const time = VALID_TIME
      expect(generateTimestamp(date, time)).toBeTruthy()
    })

    it('[Valid]: Long date format for SG (with time)', () => {
      const date = '05 Sept 2023'
      const time = VALID_TIME
      expect(generateTimestamp(date, time)).toBeTruthy()
    })

    it('[Invalid]: Wrong day format', () => {
      const date = '32 Sep 2023'
      const time = DEFAULT_TIME
      expect(generateTimestamp(date, time)).toBeFalsy()
    })

    it('[Invalid]: Wrong day padding', () => {
      const date = '5 Oct 2023'
      const time = DEFAULT_TIME
      expect(generateTimestamp(date, time)).toBeFalsy()
    })

    it('[Invalid]: Wrong time format', () => {
      const date = '05 Oct 2023'
      const time = INVALID_TIME_2
      expect(generateTimestamp(date, time)).toBeFalsy()
    })
  })

  describe('4. Miscellaneous', () => {
    it('Empty date and empty time', () => {
      const date = ''
      const time = DEFAULT_TIME
      expect(generateTimestamp(date, time)).toBeFalsy()
    })

    it('Empty date and valid time', () => {
      const date = ''
      const time = VALID_TIME
      expect(generateTimestamp(date, time)).toBeFalsy()
    })

    it('Random date 1', () => {
      const date = '111'
      const time = DEFAULT_TIME
      expect(generateTimestamp(date, time)).toBeFalsy()
    })

    it('Random date 2', () => {
      const date = '?? ??? ????'
      const time = VALID_TIME
      expect(generateTimestamp(date, time)).toBeFalsy()
    })
  })
})
