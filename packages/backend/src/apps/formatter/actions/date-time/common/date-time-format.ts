import type { IField } from '@plumber/types'

import { DateTime } from 'luxon'
import z from 'zod'

/**
 * This file contains stuff to handle all the date formats we want to support:
 * - Field and schema definitions
 * - Parsing functions
 */

interface DateFormatConverter {
  parse: (input: string) => DateTime
  stringify: (dateTime: DateTime) => string
}

const supportedFormats = z.enum(['formsgSubmissionTime', 'formsgDateField'])

const formatConverters = {
  formsgSubmissionTime: {
    parse: (input: string): DateTime => DateTime.fromISO(input),
    stringify: (dateTime: DateTime): string => dateTime.toISO(),
  },
  formsgDateField: {
    parse: (input: string): DateTime => {
      return DateTime.fromFormat(
        // Edge case: FormSG sends us "Sep" instead of "Sept" but luxon only
        // supports the latter, so we convert Sep to Sept if needed.
        input.replace(' Sep ', ' Sept '),
        'dd MMM yyyy',
      )
    },
    stringify: (dateTime: DateTime): string => dateTime.toFormat('dd MMM yyyy'),
  },
} satisfies Record<z.infer<typeof supportedFormats>, DateFormatConverter>

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
  label: 'What format is the value in?',
  key: fieldSchema.keyof().enum.dateTimeFormat,
  type: 'dropdown' as const,
  required: true,
  variables: false,
  showOptionValue: false,
  options: [
    {
      label: 'FormSG submission time - e.g. 2024-02-25T08:15:30.250+08:00',
      description:
        'Select this if you are transforming a FormSG submission time',
      value: supportedFormats.enum.formsgSubmissionTime,
    },
    {
      // FormSG UI is a bit misleading; although the field shows dd/mm/yyyy,
      // date fields are sent as dd MMM yyyy over webhooks.
      label: 'FormSG date field - e.g. 25 Mar 2024',
      description: 'Select this if you are transforming a FormSG date field',
      value: supportedFormats.enum.formsgDateField,
    },
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
    throw new Error(result.invalidExplanation)
  }

  return result
}

export function dateTimeToString(
  dateTimeFormat: z.infer<typeof fieldSchema>['dateTimeFormat'],
  dateTime: DateTime,
): string {
  // Sanity check
  if (!dateTime.isValid) {
    throw new Error(dateTime.invalidExplanation)
  }

  return formatConverters[dateTimeFormat].stringify(dateTime)
}
