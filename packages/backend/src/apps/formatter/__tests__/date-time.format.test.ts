import '@/types/luxon-extensions'
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
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it.each([
    { toFormat: 'dd/LL/yy', expectedResult: '01/04/24' },
    { toFormat: 'dd/LL/yyyy', expectedResult: '01/04/2024' },
    { toFormat: 'dd LLL yyyy', expectedResult: '01 Apr 2024' },
    { toFormat: 'dd LLLL yyyy', expectedResult: '01 April 2024' },
    { toFormat: 'yyyy/LL/dd', expectedResult: '2024/04/01' },
    { toFormat: 'yyyy-LL-dd', expectedResult: '2024-04-01' },
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

      expect(mocks.setActionItem).toHaveBeenCalledWith({
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
    {
      inputFormat: 'dd/LL/yy',
      inputValue: '01/04/24',
      toFormat: 'dd/LL/yyyy',
      expectedResult: '01/04/2024',
    },
    {
      inputFormat: 'dd/LL/yyyy',
      inputValue: '01/04/2024',
      toFormat: 'dd LLLL yyyy',
      expectedResult: '01 April 2024',
    },
    {
      inputFormat: 'dd LLLL yyyy',
      inputValue: '01 April 2024',
      toFormat: 'yyyy/LL/dd',
      expectedResult: '2024/04/01',
    },
    {
      inputFormat: 'yyyy/LL/dd',
      inputValue: '2024/04/01',
      toFormat: 'hh:mm a',
      expectedResult: '12:00 am',
    },
    {
      inputFormat: 'yyyy-LL-dd',
      inputValue: '2024-04-01',
      toFormat: 'dd/LL/yy',
      expectedResult: '01/04/24',
    },
    {
      inputFormat: 'hh:mm a',
      inputValue: '11:45 pm',
      toFormat: 'hh:mm:ss a',
      expectedResult: '11:45:00 pm',
    },
    {
      inputFormat: 'hh:mm:ss a',
      inputValue: '11:45:00 pm',
      toFormat: 'hh:mm a',
      expectedResult: '11:45 pm',
    },
    {
      inputFormat: 'dd LLL yyyy hh:mm a',
      inputValue: '01 Apr 2024 11:45 pm',
      toFormat: 'dd LLL yyyy',
      expectedResult: '01 Apr 2024',
    },
    {
      inputFormat: 'dd LLL yyyy hh:mm:ss a',
      inputValue: '01 Apr 2024 11:45:30 pm',
      toFormat: 'hh:mm:ss a',
      expectedResult: '11:45:30 pm',
    },
  ])('can handle all supported input formats', (testParams) => {
    const { inputFormat, inputValue, toFormat, expectedResult } = testParams
    $.step.parameters = {
      dateTimeFormat: inputFormat,
      formatDateTimeToFormat: toFormat,
    }
    spec.transformData($, inputValue)

    expect(mocks.setActionItem).toHaveBeenCalledWith({
      raw: { result: expectedResult },
    })
  })

  // Test that formats accept both single-padded and double-padded input
  it.each([
    // dd/LL/yy accepts both padded and non-padded
    {
      inputFormat: 'dd/LL/yy',
      inputValue: '01/04/24',
      toFormat: 'dd/LL/yyyy',
      expectedResult: '01/04/2024',
    },
    {
      inputFormat: 'dd/LL/yy',
      inputValue: '1/4/24',
      toFormat: 'dd/LL/yyyy',
      expectedResult: '01/04/2024',
    },
    // dd/LL/yyyy accepts both padded and non-padded
    {
      inputFormat: 'dd/LL/yyyy',
      inputValue: '05/12/2025',
      toFormat: 'dd LLL yyyy',
      expectedResult: '05 Dec 2025',
    },
    {
      inputFormat: 'dd/LL/yyyy',
      inputValue: '5/12/2025',
      toFormat: 'dd LLL yyyy',
      expectedResult: '05 Dec 2025',
    },
    // yyyy/LL/dd accepts both padded and non-padded
    {
      inputFormat: 'yyyy/LL/dd',
      inputValue: '2024/04/01',
      toFormat: 'dd/LL/yy',
      expectedResult: '01/04/24',
    },
    {
      inputFormat: 'yyyy/LL/dd',
      inputValue: '2024/4/1',
      toFormat: 'dd/LL/yy',
      expectedResult: '01/04/24',
    },
    // hh:mm a accepts both padded and non-padded hour
    {
      inputFormat: 'hh:mm a',
      inputValue: '09:30 am',
      toFormat: 'hh:mm:ss a',
      expectedResult: '09:30:00 am',
    },
    {
      inputFormat: 'hh:mm a',
      inputValue: '9:30 am',
      toFormat: 'hh:mm:ss a',
      expectedResult: '09:30:00 am',
    },
    // dd LLL yyyy hh:mm a accepts both padded and non-padded
    {
      inputFormat: 'dd LLL yyyy hh:mm a',
      inputValue: '05 Apr 2024 09:30 am',
      toFormat: 'dd/LL/yyyy',
      expectedResult: '05/04/2024',
    },
    {
      inputFormat: 'dd LLL yyyy hh:mm a',
      inputValue: '5 Apr 2024 9:30 am',
      toFormat: 'dd/LL/yyyy',
      expectedResult: '05/04/2024',
    },
  ])('accepts both single-padded and double-padded input', (testParams) => {
    const { inputFormat, inputValue, toFormat, expectedResult } = testParams
    $.step.parameters = {
      dateTimeFormat: inputFormat,
      formatDateTimeToFormat: toFormat,
    }
    spec.transformData($, inputValue)

    expect(mocks.setActionItem).toHaveBeenCalledWith({
      raw: { result: expectedResult },
    })
  })

  it.each([
    {
      inputFormat: 'formsgDateField',
      inputValue: '01 Sept 2025',
      toFormat: 'dd LLL yyyy',
      expectedResult: '01 Sep 2025',
    },
    {
      inputFormat: 'formsgDateField',
      inputValue: '02 Sep 2025',
      toFormat: 'dd LLL yyyy',
      expectedResult: '02 Sep 2025',
    },
    {
      inputFormat: 'dd LLL yyyy hh:mm a',
      inputValue: '03 Sep 2025 11:50 pm',
      toFormat: 'dd LLL yyyy',
      expectedResult: '03 Sep 2025',
    },
    {
      inputFormat: 'dd LLL yyyy hh:mm:ss a',
      inputValue: '04 Sept 2025 11:45:30 pm',
      toFormat: 'dd LLL yyyy hh:mm a',
      expectedResult: '04 Sep 2025 11:45 pm',
    },
  ])('converts dd MMM yyyy format from en-SG to en-US', (testParams) => {
    const { inputFormat, inputValue, toFormat, expectedResult } = testParams
    $.step.parameters = {
      dateTimeFormat: inputFormat,
      formatDateTimeToFormat: toFormat,
    }
    spec.transformData($, inputValue)

    expect(mocks.setActionItem).toHaveBeenCalledWith({
      raw: { result: expectedResult },
    })
  })
})
