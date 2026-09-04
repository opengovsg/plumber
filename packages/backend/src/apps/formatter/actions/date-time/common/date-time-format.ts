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

// All date parsing is pinned to Singapore time so that comparisons and
// differences are not subject to off-by-one errors from a differing server
// timezone.
export const SG_TIMEZONE = 'Asia/Singapore'

const supportedFormats = z.enum([
  'formsgSubmissionTime',
  'formsgDateField', // dd LLL yyyy; this is kept due to backwards compatibility
  'now', // input-only: ignores the value field, uses current SG time
  'excelFormattedDate', // input-only: e.g. 45292 -> 1 Jan 2024
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
  now: {
    description: 'current date / time',
    // Input-only: the value field is ignored (hidden in the UI). We always
    // use the current time in Singapore.
    parse: (_input: string): DateTime => DateTime.now().setZone(SG_TIMEZONE),
    stringify: (): string => {
      throw new Error('"Now" is an input-only format and cannot be output to')
    },
  },
  excelFormattedDate: {
    description: 'Excel formatted date',
    parse: (input: string): DateTime => {
      const serial = Number(input?.toString().trim())
      // Reject non-numbers and <= 0 (the 0 / negative serials are the
      // "1900-01-00" oddity we don't want to support).
      if (!Number.isFinite(serial) || serial <= 0) {
        return DateTime.invalid('Invalid Excel formatted date')
      }
      // Excel's 1900 date system. Serial 1 = 1900-01-01, but Excel incorrectly
      // treats 1900 as a leap year, so the corrected epoch is 1899-12-30.
      // The fractional part of the serial is the time of day, so a plain
      // `.plus({ days })` handles both date and time.
      const excelEpoch = DateTime.fromObject(
        { year: 1899, month: 12, day: 30 },
        { zone: SG_TIMEZONE },
      )
      return excelEpoch.plus({ days: serial })
    },
    stringify: (): string => {
      throw new Error(
        'Excel formatted date is an input-only format and cannot be output to',
      )
    },
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
      return DateTime.fromFormat(input, 'd MMM yyyy', { locale: 'en-SG' })
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

// Exported so the schema can be reused by other actions (e.g. the
// compare / calculate action's two date operands).
export { supportedFormats }

export const fieldSchema = z.object({
  // NOTE: Likely we will support arbitrary input in the future and this can no
  // longer be an enum. If that happens we can use a type guard to simulate
  // enum-like functionality for formats we explicitly support.
  dateTimeFormat: supportedFormats,
})

// The full list of input format options. Exported so any field that lets a
// user declare the format of an incoming date (e.g. each operand of the
// compare / calculate action) can reuse the exact same list.
export const inputFormatOptions = [
  {
    label: 'Now (current date / time)',
    description: 'Uses the current date and time in Singapore',
    value: supportedFormats.enum.now,
  },
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
  {
    label: 'Excel formatted date',
    description: 'e.g. 45292 → 1 Jan 2024',
    value: supportedFormats.enum.excelFormattedDate,
  },
  // Exclude repeated option due to formsgDateField
  ...commonDateFormatOptions.filter((option) => option.value !== 'dd LLL yyyy'),
]

export const field = {
  label: 'What format is your date / time in?',
  key: fieldSchema.keyof().enum.dateTimeFormat,
  type: 'dropdown' as const,
  required: true,
  variables: false,
  showOptionValue: false,
  // "Now" is excluded here: it's a date *source*, not a format, and in this
  // action the value field can't be hidden when it's picked (single-condition
  // `hiddenIf`), so it would read confusingly. It stays available in the
  // compare/calculate action, where the value field does hide.
  options: inputFormatOptions.filter(
    (option) => option.value !== supportedFormats.enum.now,
  ),
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
