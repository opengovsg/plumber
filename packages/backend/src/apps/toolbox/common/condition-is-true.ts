import type { IJSONObject, IJSONValue } from '@plumber/types'

import { generateTimestampFromFormats } from '@/helpers/generate-timestamp-from-formats'

function compareNumbers(
  field: IJSONValue,
  condition: 'gte' | 'gt' | 'lte' | 'lt',
  value: IJSONValue,
): boolean {
  // WARNING: can only compare safely up till Number.MAX_SAFE_INTEGER but BigInt cannot compare floats...
  if (isNaN(Number(field))) {
    throw new Error('Non-number used in field for comparison')
  }

  if (isNaN(Number(value))) {
    throw new Error('Non-number used in value for comparison')
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

// support only formatter date formats
const VALID_DATETIME_FORMATS = [
  'dd/LL/yy',
  'dd/LL/yyyy',
  'dd LLL yyyy',
  'dd LLLL yyyy',
  'yyyy/LL/dd',
  'dd LLL yyyy hh:mm a',
  'dd LLL yyyy hh:mm:ss a',
]

function compareDates(
  field: IJSONValue,
  condition: 'before' | 'after',
  value: IJSONValue,
) {
  const fieldTimestamp = generateTimestampFromFormats(
    field as string,
    VALID_DATETIME_FORMATS,
  )
  if (isNaN(fieldTimestamp)) {
    throw new Error('Invalid date used in field for comparison')
  }

  const valueTimestamp = generateTimestampFromFormats(
    value as string,
    VALID_DATETIME_FORMATS,
  )
  if (isNaN(valueTimestamp)) {
    throw new Error('Invalid date used in value for comparison')
  }

  switch (condition) {
    case 'before':
      return fieldTimestamp < valueTimestamp
    case 'after':
      return fieldTimestamp > valueTimestamp
  }
}

export default function conditionIsTrue(conditionArgs: IJSONObject): boolean {
  // `value` is named `text` for legacy reasons.
  const { field, is, condition, text: value } = conditionArgs

  let result: boolean
  switch (condition) {
    case 'equals':
      result = field === value
      break
    case 'before':
    case 'after':
      result = compareDates(field, condition, value)
      break
    case 'gte':
    case 'gt':
    case 'lte':
    case 'lt':
      result = compareNumbers(field, condition, value)
      break
    case 'contains':
      result = field.toString().includes(value.toString())
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
      throw new Error(
        `Conditional logic block contains an unknown operator: ${condition}`,
      )
  }

  if (is === 'not') {
    result = !result
  }

  return result
}
