import { describe, expect, it } from 'vitest'

import generateTimestamp from '../helpers/generate-timestamp'

const EMPTY_TIME = ''
const VALID_TIME = '12:00'
// const INVALID_TIME_1 = '25:00'
// const INVALID_TIME_2 = '00:60'

/** formats to allow for date time
1. yyyy-MM-dd'T'HH:mm:ss.SSSZ - ISO DateTime format
2. yyyy-MM-dd HH:mm - ISO Complete Date format
3. dd MMM yyyy HH:mm - long date format
4. dd/MM/yyyy HH:mm - short date format 
*/

describe('delay until date and time handler', () => {
  it('[Valid] ISO DateTime format', () => {
    const date = '2023-09-05T12:00:00.000Z'
    const time = EMPTY_TIME
    expect(generateTimestamp(date, time)).toBeTruthy()
  })

  it('[Invalid] ISO DateTime format', () => {
    const date = '2023-09-05 12:00:00.000Z'
    const time = EMPTY_TIME
    expect(generateTimestamp(date, time)).toBeFalsy()
  })

  it('[Invalid] ISO DateTime invalid month', () => {
    const date = '2023-13-05'
    const time = EMPTY_TIME
    expect(generateTimestamp(date, time)).toBeFalsy()
  })

  it('[Invalid] ISO DateTime invalid day', () => {
    const date = '2023-12-32'
    const time = EMPTY_TIME
    expect(generateTimestamp(date, time)).toBeFalsy()
  })

  it('[Valid]: Short date format', () => {
    const date = '05/09/2023'
    const time = VALID_TIME
    expect(generateTimestamp(date, time)).toBeTruthy()
  })

  it('[Invalid]: Short date invalid year', () => {
    const date = '05/09/20234'
    const time = VALID_TIME
    expect(generateTimestamp(date, time)).toBeFalsy()
  })

  it('[Invalid]: Short date invalid format', () => {
    const date = '05/09/2023 ??'
    const time = VALID_TIME
    expect(generateTimestamp(date, time)).toBeFalsy()
  })

  // it('Accepted: Long date format 1', () => {
  //   const date = 'Sep 5 2023'
  //   const time = EMPTY_TIME
  //   expect(generateTimestamp(date, time)).toBeTruthy()
  // })

  // it('Accepted: Long date format 2', () => {
  //   const date = '05 Sep 2023'
  //   const time = EMPTY_TIME
  //   expect(generateTimestamp(date, time)).toBeTruthy()
  // })

  // it('Invalid date input - Month', () => {
  //   const date = '14/05/2023'
  //   const time = EMPTY_TIME
  //   expect(generateTimestamp(date, time)).toBeFalsy()
  // })

  // it('Accepted date and time', () => {
  //   const date = '05 Sep 2023'
  //   const time = '12:00'
  //   expect(generateTimestamp(date, time)).toBeTruthy()
  // })

  // it('Accepted date and invalid time', () => {
  //   const date = '05 Sep 2023'
  //   const time = '25:00'
  //   expect(generateTimestamp(date, time)).toBeFalsy()
  // })

  // it('Accepted date and invalid time', () => {
  //   const date = '1'
  //   const time = '12:00'
  //   expect(generateTimestamp(date, time)).toBeFalsy()
  // })
})
