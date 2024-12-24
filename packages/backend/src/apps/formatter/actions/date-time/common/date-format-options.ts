import { z } from 'zod'

import { ensureZodEnumValue } from '@/helpers/zod-utils'

// These are the list of common input and output date format options
export const commonDateFormats = [
  'dd/LL/yy',
  'dd/LL/yyyy',
  'dd LLL yyyy',
  'dd LLLL yyyy',
  'yyyy/LL/dd',
  'hh:mm a',
  'hh:mm:ss a',
  'dd LLL yyyy hh:mm a',
  'dd LLL yyyy hh:mm:ss a',
] as const

const formatStringsEnum = z.enum(commonDateFormats)

export const commonDateFormatOptions = [
  {
    label: 'DD/MM/YY',
    description: '25/03/24',
    value: ensureZodEnumValue(formatStringsEnum, 'dd/LL/yy'),
  },
  {
    label: 'DD/MM/YYYY',
    description: '25/03/2024',
    value: ensureZodEnumValue(formatStringsEnum, 'dd/LL/yyyy'),
  },
  {
    label: 'DD MMM YYYY',
    description: '25 Mar 2024',
    value: ensureZodEnumValue(formatStringsEnum, 'dd LLL yyyy'),
  },
  {
    label: 'DD MMMM YYYY',
    description: '25 March 2024',
    value: ensureZodEnumValue(formatStringsEnum, 'dd LLLL yyyy'),
  },
  {
    label: 'YYYY/MM/DD',
    description: '2024/03/25',
    value: ensureZodEnumValue(formatStringsEnum, 'yyyy/LL/dd'),
  },
  {
    label: 'HH:mm (am/pm)',
    description: '12:04 PM',
    value: ensureZodEnumValue(formatStringsEnum, 'hh:mm a'),
  },
  {
    label: 'HH:mm:ss (am/pm)',
    description: '12:04:05 pm',
    value: ensureZodEnumValue(formatStringsEnum, 'hh:mm:ss a'),
  },
  {
    label: 'DD MMM YYYY HH:mm (am/pm)',
    description: '25 Mar 2024 12:04 pm',
    value: ensureZodEnumValue(formatStringsEnum, 'dd LLL yyyy hh:mm a'),
  },
  {
    label: 'DD MMM YYYY HH:mm:ss (am/pm)',
    description: '25 Mar 2024 12:04:05 pm',
    value: ensureZodEnumValue(formatStringsEnum, 'dd LLL yyyy hh:mm:ss a'),
  },
]
