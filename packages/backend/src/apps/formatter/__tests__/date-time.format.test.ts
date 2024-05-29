import { IGlobalVariable } from '@plumber/types'

import { Settings as LuxonSettings } from 'luxon'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { spec } from '../actions/date-time/transforms/convert-date-time'

// TZ formatting replicated here (see appConfig) as tests don't load the app
// config module.
LuxonSettings.defaultZone = 'Asia/Singapore'
LuxonSettings.defaultLocale = 'en-SG'

const mocks = vi.hoisted(() => ({
  setActionItem: vi.fn(),
}))

describe('convert date time', () => {
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
    { toFormat: 'dd/LL/yy', expectedResult: '01/04/24' },
    { toFormat: 'dd/LL/yyyy', expectedResult: '01/04/2024' },
    { toFormat: 'dd LLL yyyy', expectedResult: '01 Apr 2024' },
    { toFormat: 'dd LLLL yyyy', expectedResult: '01 April 2024' },
    { toFormat: 'yy/LL/dd', expectedResult: '24/04/01' },
    { toFormat: 'yyyy/LL/dd', expectedResult: '2024/04/01' },
    { toFormat: 'hh:mm a', expectedResult: '12:05 pm' },
    { toFormat: 'hh:mm:ss a', expectedResult: '12:05:10 pm' },
    { toFormat: 'dd LLL yyyy hh:mm a', expectedResult: '01 Apr 2024 12:05 pm' },
    {
      toFormat: 'dd LLL yyyy hh:mm:ss a',
      expectedResult: '01 Apr 2024 12:05:10 pm',
    },
  ])(
    'formats input to the selected format correctly',
    ({ toFormat, expectedResult }) => {
      $.step.parameters = {
        dateTimeFormat: 'formsgSubmissionTime',
        formatDateTimeToFormat: toFormat,
      }
      spec.transformData($, '2024-04-01T12:05:10.000+08:00')

      expect(mocks.setActionItem).toBeCalledWith({
        raw: { result: expectedResult },
      })
    },
  )

  it.each([
    {
      inputFormat: 'formsgSubmissionTime',
      inputValue: '2024-04-01T23:45:08.000+08:00',
      toFormat: 'dd LLL yyyy hh:mm a',
      expectedResult: '01 Apr 2024 11:45 pm',
    },
    {
      inputFormat: 'formsgDateField',
      inputValue: '01 Apr 2024',
      toFormat: 'dd/LL/yy',
      expectedResult: '01/04/24',
    },
  ])('can handle all supported input formats', (testParams) => {
    const { inputFormat, inputValue, toFormat, expectedResult } = testParams
    $.step.parameters = {
      dateTimeFormat: inputFormat,
      formatDateTimeToFormat: toFormat,
    }
    spec.transformData($, inputValue)

    expect(mocks.setActionItem).toBeCalledWith({
      raw: { result: expectedResult },
    })
  })
})
