import type { IJSONObject, IJSONValue, StepErrorKind } from '@plumber/types'
import { DateTime } from 'luxon'

import StepError from '@/errors/step'
import { generateTimestampFromFormats } from '@/helpers/generate-timestamp-from-formats'

export function makeConditionGroupError(
  groupNumber: number,
  message: string,
  kind: StepErrorKind,
): StepError {
  return new StepError({
    name: `Error in condition group ${groupNumber}: ${message}`,
    solution: 'Check that the condition has been configured properly.',
    kind,
  })
}

function compareNumbers(
  field: IJSONValue,
  condition: 'gte' | 'gt' | 'lte' | 'lt',
  value: IJSONValue,
  groupNumber: number,
): boolean {
  // WARNING: can only compare safely up till Number.MAX_SAFE_INTEGER but BigInt cannot compare floats...
  if (isNaN(Number(field))) {
    throw makeConditionGroupError(
      groupNumber,
      'Non-number used in field for comparison',
      'config',
    )
  }

  if (isNaN(Number(value))) {
    throw makeConditionGroupError(
      groupNumber,
      'Non-number used in value for comparison',
      'config',
    )
  }

  switch (condition) {
    case 'gte':
      return Number(field) >= Number(value)
    case 'gt':
      return Number(field) > Number(value)
    case 'lte':
      return Number(field) <= Number(value)
    case 'lt':
      return Number(field) < Number(value)
  }
}

// support only formatter date formats (single-letter tokens are more lenient)
const VALID_DATETIME_FORMATS = [
  'd/L/yy',
  'd/L/yyyy',
  'd LLL yyyy',
  'd LLLL yyyy',
  'yyyy/L/d',
  'yyyy-L-d',
  'd LLL yyyy h:mm a',
  'd LLL yyyy h:mm:ss a',
]

// Plumber variables (e.g. scheduler, FormSG submission time) emit ISO 8601, which no fixed format matches.
function parseDate(input: IJSONValue): number {
  const timestamp = generateTimestampFromFormats(
    input as string,
    VALID_DATETIME_FORMATS,
  )
  if (!isNaN(timestamp) || typeof input !== 'string') {
    return timestamp
  }
  const isoDateTime = DateTime.fromISO(input)
  return isoDateTime.isValid ? isoDateTime.toMillis() : NaN
}

function compareDates(
  field: IJSONValue,
  condition: 'before' | 'after',
  value: IJSONValue,
  groupNumber: number,
) {
  const fieldTimestamp = parseDate(field)
  if (isNaN(fieldTimestamp)) {
    throw makeConditionGroupError(
      groupNumber,
      'Invalid date used in field for comparison',
      'config',
    )
  }

  const valueTimestamp = parseDate(value)
  if (isNaN(valueTimestamp)) {
    throw makeConditionGroupError(
      groupNumber,
      'Invalid date used in value for comparison',
      'config',
    )
  }

  switch (condition) {
    case 'before':
      return fieldTimestamp < valueTimestamp
    case 'after':
      return fieldTimestamp > valueTimestamp
  }
}

export default function conditionIsTrue(
  conditionArgs: IJSONObject,
  groupNumber: number,
): boolean {
  // `value` is named `text` for legacy reasons.
  const { field, is, condition, text: value } = conditionArgs

  let result: boolean
  switch (condition) {
    case 'equals':
      result = field === value
      break
    case 'before':
    case 'after':
      result = compareDates(field, condition, value, groupNumber)
      break
    case 'gte':
    case 'gt':
    case 'lte':
    case 'lt':
      result = compareNumbers(field, condition, value, groupNumber)
      break
    case 'contains':
      result = field.toString().includes(value.toString())
      break
    case 'begins':
      result = field.toString().startsWith(value.toString())
      break
    case 'empty':
      // `field` and `value` are a bit of a misnomer. They're both form fields
      // that the user inputs data into.  The "empty" condition is unary, so the
      // `value` field is hidden from the user. Thus we only need to check
      // `field` field.

      // Strings are empty if they are falsey.
      // All other types (e.g. 0, {}) are considered non-empty unless they are
      // null or undefined
      result = field === null || field === undefined || field === ''
      break
    default:
      throw makeConditionGroupError(
        groupNumber,
        `Conditional logic block contains an unknown operator: ${condition}`,
        'internal',
      )
  }

  if (is === 'not') {
    result = !result
  }

  return result
}
