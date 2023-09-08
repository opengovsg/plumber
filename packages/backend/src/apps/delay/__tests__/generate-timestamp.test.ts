import { describe, expect, it } from 'vitest'

import generateTimestamp from '../helpers/generate-timestamp'

const EMPTY_TIME = ''

describe('delay until date and time handler', () => {
  it('Accepted: ISO date format', () => {
    const date = '2023-09-05'
    const time = EMPTY_TIME
    expect(generateTimestamp(date, time)).toBeTruthy()
  })

  it('Accepted: Short date format', () => {
    const date = '09/05/2023'
    const time = EMPTY_TIME
    expect(generateTimestamp(date, time)).toBeTruthy()
  })

  it('Accepted: Long date format 1', () => {
    const date = 'Sep 5 2023'
    const time = EMPTY_TIME
    expect(generateTimestamp(date, time)).toBeTruthy()
  })

  it('Accepted: Long date format 2', () => {
    const date = '05 Sep 2023'
    const time = EMPTY_TIME
    expect(generateTimestamp(date, time)).toBeTruthy()
  })

  it('Invalid date input - Month', () => {
    const date = '14/05/2023'
    const time = EMPTY_TIME
    expect(generateTimestamp(date, time)).toBeFalsy()
  })

  it('Accepted date and time', () => {
    const date = '05 Sep 2023'
    const time = '12:00'
    expect(generateTimestamp(date, time)).toBeTruthy()
  })

  it('Accepted date and invalid time', () => {
    const date = '05 Sep 2023'
    const time = '25:00'
    expect(generateTimestamp(date, time)).toBeFalsy()
  })
})
