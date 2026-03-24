import type { IField } from '@plumber/types'

import { DateTime } from 'luxon'
import z from 'zod'

import {
  commonDateFormatOptions,
  commonDateFormats,
} from './date-format-options'

/**
 * This file contains stuff to handle all the date formats we want to support:
 * - Field and schema definitions
 * - Parsing functions
 */

interface DateFormatConverter {
  // Human-friendly description of what this is parsing
  description: string

  parse: (input: string) => DateTime
  stringify: (dateTime: DateTime) => string
}

const supportedFormats = z.enum([
  'formsgSubmissionTime',
  'formsgDateField', // dd LLL yyyy; this is kept due to backwards compatibility
  ...commonDateFormats,
])

// Map strict formats to lenient equivalents for parsing
// Single-letter tokens (d, L, h) accept both padded and non-padded input
const toLenientFormatMap: Record<string, string> = {
  'dd/LL/yy': 'd/L/yy',
  'dd/LL/yyyy': 'd/L/yyyy',
  'dd LLL yyyy': 'd LLL yyyy',
  'dd LLLL yyyy': 'd LLLL yyyy',
  'yyyy/LL/dd': 'yyyy/L/d',
  'yyyy-LL-dd': 'yyyy-L-d',
  'hh:mm a': 'h:mm a',
  'hh:mm:ss a': 'h:mm:ss a',
  'dd LLL yyyy hh:mm a': 'd LLL yyyy h:mm a',
  'dd LLL yyyy hh:mm:ss a': 'd LLL yyyy h:mm:ss a',
}

const formatConverters = Object.assign({
  formsgSubmissionTime: {
    description: 'FormSG submission time',
    parse: (input: string): DateTime => DateTime.fromISO(input),
    stringify: (dateTime: DateTime): string => dateTime.toISO(),
  },
  formsgDateField: {
    description: 'FormSG date field',
    parse: (input: string): DateTime => {
      // NOTE:
      // ---
      // FormSG actually formats date fields in the en-US locale. But we will
      // also allow parsing this input as en-SG, since it's possible end users
      // may mis-use this option to parse their own dates.
      //
      // At time of this comment, the only effective difference between en-US
      // and en-SG is September - the former only accepts "Sep", and the latter
      // only accepts "Sept"
      //
      // We use 'd MMM yyyy' (single-letter d) for lenient parsing to accept
      // both single and double-padded day input (e.g., '5 Apr 2024' or '05 Apr 2024')

      const dateTime = DateTime.fromFormat(input, 'd MMM yyyy', {
        locale: 'en-US',
      })

      if (dateTime.isValid) {
        return dateTime
      }

      // en-US parsing failed, fall back to en-SG.
      return DateTime.fromFormat(input, 'd MMM yyyy')
    },
    stringify: (dateTime: DateTime): string =>
      dateTime.toPlumberFormat('dd MMM yyyy'),
  },
  ...Object.fromEntries(
    commonDateFormats
      .filter((format) => format !== 'dd LLL yyyy') // Exclude repeated option due to formsgDateField
      .map((format) => {
        // Use lenient format for parsing (accepts both padded and non-padded)
        const parseFormat = toLenientFormatMap[format] ?? format
        return [
          format,
          {
            description: format,
            parse: (input: string): DateTime => {
              const result = DateTime.fromFormat(input, parseFormat, {
                locale: 'en-US',
              })
              if (result.isValid) {
                return result
              }
              return DateTime.fromFormat(input, parseFormat, {
                locale: 'en-SG',
              })
            },
            stringify: (dateTime: DateTime): string =>
              dateTime.toPlumberFormat(format),
          },
        ]
      }),
  ),
}) satisfies Record<z.infer<typeof supportedFormats>, DateFormatConverter>

//
// Field definitions and schema
//

export const fieldSchema = z.object({
  // NOTE: Likely we will support arbitrary input in the future and this can no
  // longer be an enum. If that happens we can use a type guard to simulate
  // enum-like functionality for formats we explicitly support.
  dateTimeFormat: supportedFormats,
})

export const field = {
  label: 'Select the format of your value',
  key: fieldSchema.keyof().enum.dateTimeFormat,
  type: 'dropdown' as const,
  required: true,
  variables: false,
  showOptionValue: false,
  options: [
    {
      label: 'FormSG Submission Time',
      description: '2024-03-25T08:15:30.250+08:00',
      value: supportedFormats.enum.formsgSubmissionTime,
    },
    {
      // FormSG UI is a bit misleading; although the field shows dd/mm/yyyy,
      // date fields are sent as dd MMM yyyy over webhooks.
      label: 'FormSG Date Field - DD MMM YYYY',
      description: '25 Mar 2024',
      value: supportedFormats.enum.formsgDateField,
    },
    // Exclude repeated option due to formsgDateField
    ...commonDateFormatOptions.filter(
      (option) => option.value !== 'dd LLL yyyy',
    ),
  ],
} satisfies IField

//
// Parsing and conversion functions
//

export function parseDateTime(
  dateTimeFormat: z.infer<typeof fieldSchema>['dateTimeFormat'],
  valueToTransform: string,
): DateTime {
  const result = formatConverters[dateTimeFormat].parse(valueToTransform)

  if (!result.isValid) {
    throw new Error(
      `${valueToTransform}' is not a valid ${formatConverters[dateTimeFormat].description}`,
    )
  }

  return result
}

export function dateTimeToString(
  dateTimeFormat: z.infer<typeof fieldSchema>['dateTimeFormat'],
  dateTime: DateTime,
): string {
  // Sanity check - users should never see this.
  if (!dateTime.isValid) {
    throw new Error('Stringifying invalid DateTime')
  }

  return formatConverters[dateTimeFormat].stringify(dateTime)
}
