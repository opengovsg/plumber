import { IGlobalVariable } from '@plumber/types'

import { Settings as LuxonSettings } from 'luxon'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { transformData } from '../actions/date-time/transforms/add-subtract-date-time/transform-data'

// TZ formatting replicated here (see appConfig) as tests don't load the app
// config module.
LuxonSettings.defaultZone = 'Asia/Singapore'
LuxonSettings.defaultLocale = 'en-SG'

const mocks = vi.hoisted(() => ({
  setActionItem: vi.fn(),
}))

describe('add / subtract date time', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      step: {
        parameters: {},
      },
      setActionItem: mocks.setActionItem,
    } as unknown as IGlobalVariable
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    // Addition
    {
      op: { opType: 'add', timeUnit: 'seconds', timeAmount: '37' },
      expectedResult: '2024-04-01T12:05:47.000+08:00',
    },
    {
      op: { opType: 'add', timeUnit: 'minutes', timeAmount: '20' },
      expectedResult: '2024-04-01T12:25:10.000+08:00',
    },
    {
      op: { opType: 'add', timeUnit: 'hours', timeAmount: '3' },
      expectedResult: '2024-04-01T15:05:10.000+08:00',
    },
    {
      op: { opType: 'add', timeUnit: 'days', timeAmount: '1' },
      expectedResult: '2024-04-02T12:05:10.000+08:00',
    },
    {
      op: { opType: 'add', timeUnit: 'months', timeAmount: '2' },
      expectedResult: '2024-06-01T12:05:10.000+08:00',
    },
    {
      op: { opType: 'add', timeUnit: 'months', timeAmount: '0' },
      expectedResult: '2024-04-01T12:05:10.000+08:00',
    },

    // Addition (negative numbers)
    {
      op: { opType: 'add', timeUnit: 'seconds', timeAmount: '-8' },
      expectedResult: '2024-04-01T12:05:02.000+08:00',
    },
    {
      op: { opType: 'add', timeUnit: 'minutes', timeAmount: '-3' },
      expectedResult: '2024-04-01T12:02:10.000+08:00',
    },
    {
      op: { opType: 'add', timeUnit: 'hours', timeAmount: '-9' },
      expectedResult: '2024-04-01T03:05:10.000+08:00',
    },
    {
      op: { opType: 'add', timeUnit: 'days', timeAmount: '-0' },
      expectedResult: '2024-04-01T12:05:10.000+08:00',
    },
    {
      op: { opType: 'add', timeUnit: 'months', timeAmount: '-1' },
      expectedResult: '2024-03-01T12:05:10.000+08:00',
    },

    // Subtraction
    {
      op: { opType: 'subtract', timeUnit: 'seconds', timeAmount: '8' },
      expectedResult: '2024-04-01T12:05:02.000+08:00',
    },
    {
      op: { opType: 'subtract', timeUnit: 'minutes', timeAmount: '2' },
      expectedResult: '2024-04-01T12:03:10.000+08:00',
    },
    {
      op: { opType: 'subtract', timeUnit: 'hours', timeAmount: '3' },
      expectedResult: '2024-04-01T09:05:10.000+08:00',
    },
    {
      op: { opType: 'subtract', timeUnit: 'days', timeAmount: '1' },
      expectedResult: '2024-03-31T12:05:10.000+08:00',
    },
    {
      op: { opType: 'subtract', timeUnit: 'months', timeAmount: '3' },
      expectedResult: '2024-01-01T12:05:10.000+08:00',
    },
    {
      op: { opType: 'subtract', timeUnit: 'months', timeAmount: '0' },
      expectedResult: '2024-04-01T12:05:10.000+08:00',
    },

    // Subtraction (negative numbers)
    {
      op: { opType: 'subtract', timeUnit: 'seconds', timeAmount: '-8' },
      expectedResult: '2024-04-01T12:05:18.000+08:00',
    },
    {
      op: { opType: 'subtract', timeUnit: 'minutes', timeAmount: '-3' },
      expectedResult: '2024-04-01T12:08:10.000+08:00',
    },
    {
      op: { opType: 'subtract', timeUnit: 'hours', timeAmount: '-0' },
      expectedResult: '2024-04-01T12:05:10.000+08:00',
    },
    {
      op: { opType: 'subtract', timeUnit: 'days', timeAmount: '-5' },
      expectedResult: '2024-04-06T12:05:10.000+08:00',
    },
    {
      op: { opType: 'subtract', timeUnit: 'months', timeAmount: '-7' },
      expectedResult: '2024-11-01T12:05:10.000+08:00',
    },
  ])(
    'can $op.opType $op.timeAmount $op.timeUnit (without overflow / underflow)',
    ({ op, expectedResult }) => {
      $.step.parameters = {
        dateTimeFormat: 'formsgSubmissionTime',
        addSubtractDateTimeOps: [op],
      }
      transformData($, '2024-04-01T12:05:10.000+08:00')
      expect(mocks.setActionItem).toBeCalledWith({
        raw: { result: expectedResult },
      })
    },
  )

  it.each([
    // Addition
    {
      op: { opType: 'add', timeUnit: 'seconds', timeAmount: '3680' },
      expectedResult: '2024-04-01T13:06:30.000+08:00',
    },
    {
      op: { opType: 'add', timeUnit: 'minutes', timeAmount: '90' },
      expectedResult: '2024-04-01T13:35:10.000+08:00',
    },
    {
      op: { opType: 'add', timeUnit: 'hours', timeAmount: '48' },
      expectedResult: '2024-04-03T12:05:10.000+08:00',
    },
    {
      op: { opType: 'add', timeUnit: 'days', timeAmount: '38' },
      expectedResult: '2024-05-09T12:05:10.000+08:00',
    },
    {
      op: { opType: 'add', timeUnit: 'months', timeAmount: '22' },
      expectedResult: '2026-02-01T12:05:10.000+08:00',
    },

    // Addition (negative numbers)
    {
      op: { opType: 'add', timeUnit: 'seconds', timeAmount: '-15' },
      expectedResult: '2024-04-01T12:04:55.000+08:00',
    },
    {
      op: { opType: 'add', timeUnit: 'minutes', timeAmount: '-30' },
      expectedResult: '2024-04-01T11:35:10.000+08:00',
    },
    {
      op: { opType: 'add', timeUnit: 'hours', timeAmount: '-20' },
      expectedResult: '2024-03-31T16:05:10.000+08:00',
    },
    {
      op: { opType: 'add', timeUnit: 'days', timeAmount: '-3' },
      expectedResult: '2024-03-29T12:05:10.000+08:00',
    },
    {
      op: { opType: 'add', timeUnit: 'months', timeAmount: '-8' },
      expectedResult: '2023-08-01T12:05:10.000+08:00',
    },

    // Subtraction
    {
      op: { opType: 'subtract', timeUnit: 'seconds', timeAmount: '182' },
      expectedResult: '2024-04-01T12:02:08.000+08:00',
    },
    {
      op: { opType: 'subtract', timeUnit: 'minutes', timeAmount: '90' },
      expectedResult: '2024-04-01T10:35:10.000+08:00',
    },
    {
      op: { opType: 'subtract', timeUnit: 'hours', timeAmount: '72' },
      expectedResult: '2024-03-29T12:05:10.000+08:00',
    },
    {
      op: { opType: 'subtract', timeUnit: 'days', timeAmount: '366' },
      expectedResult: '2023-04-01T12:05:10.000+08:00',
    },
    {
      op: { opType: 'subtract', timeUnit: 'months', timeAmount: '15' },
      expectedResult: '2023-01-01T12:05:10.000+08:00',
    },

    // Subtraction (negative numbers)
    {
      op: { opType: 'subtract', timeUnit: 'seconds', timeAmount: '-70' },
      expectedResult: '2024-04-01T12:06:20.000+08:00',
    },
    {
      op: { opType: 'subtract', timeUnit: 'minutes', timeAmount: '-80' },
      expectedResult: '2024-04-01T13:25:10.000+08:00',
    },
    {
      op: { opType: 'subtract', timeUnit: 'hours', timeAmount: '-12' },
      expectedResult: '2024-04-02T00:05:10.000+08:00',
    },
    {
      op: { opType: 'subtract', timeUnit: 'days', timeAmount: '-35' },
      expectedResult: '2024-05-06T12:05:10.000+08:00',
    },
    {
      op: { opType: 'subtract', timeUnit: 'months', timeAmount: '-10' },
      expectedResult: '2025-02-01T12:05:10.000+08:00',
    },
  ])(
    'can handle overflow / underflow for $op.opType $op.timeAmount $op.timeUnit',
    ({ op, expectedResult }) => {
      $.step.parameters = {
        dateTimeFormat: 'formsgSubmissionTime',
        addSubtractDateTimeOps: [op],
      }
      transformData($, '2024-04-01T12:05:10.000+08:00')
      expect(mocks.setActionItem).toBeCalledWith({
        raw: { result: expectedResult },
      })
    },
  )

  // Re-use luxon's example:
  // https://moment.github.io/luxon/#/math?id=math-with-multiple-units
  it.each([
    {
      ops: [
        { opType: 'add', timeUnit: 'months', timeAmount: '1' },
        { opType: 'add', timeUnit: 'days', timeAmount: '1' },
      ],
      expectedResult: '31 May 2017',
    },
    {
      ops: [
        { opType: 'add', timeUnit: 'days', timeAmount: '1' },
        { opType: 'add', timeUnit: 'months', timeAmount: '1' },
      ],
      expectedResult: '01 Jun 2017',
    },
  ])(
    'performs date math in the sequence specified by the user',
    ({ ops, expectedResult }) => {
      $.step.parameters = {
        dateTimeFormat: 'formsgDateField',
        addSubtractDateTimeOps: ops,
      }
      transformData($, '30 Apr 2017')
      expect(mocks.setActionItem).toBeCalledWith({
        raw: { result: expectedResult },
      })
    },
  )

  it.each([
    {
      dateTimeFormat: 'formsgSubmissionTime',
      valueToTransform: '2024-04-01T23:45:08.000+08:00',
      op: { opType: 'add', timeUnit: 'days', timeAmount: '1' },
      expectedResult: '2024-04-02T23:45:08.000+08:00',
    },
    {
      dateTimeFormat: 'formsgDateField',
      valueToTransform: '01 Apr 2024',
      op: { opType: 'add', timeUnit: 'days', timeAmount: '1' },
      expectedResult: '02 Apr 2024',
    },
  ])('preserves the input format after doing date math', (testParams) => {
    const { dateTimeFormat, valueToTransform, op, expectedResult } = testParams
    $.step.parameters = {
      dateTimeFormat,
      addSubtractDateTimeOps: [op],
    }
    transformData($, valueToTransform)
    expect(mocks.setActionItem).toBeCalledWith({
      raw: { result: expectedResult },
    })
  })
})
