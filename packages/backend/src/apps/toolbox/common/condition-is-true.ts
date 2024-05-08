import type { IJSONObject, IJSONValue } from '@plumber/types'

function compareNumbers(
  field: IJSONValue,
  condition: IJSONValue,
  value: IJSONValue,
): boolean {
  // WARNING: can only compare safely up till Number.MAX_SAFE_INTEGER but BigInt cannot compare floats...
  if (isNaN(Number(field)) || isNaN(Number(value))) {
    throw new Error('Non-number used in field or value for comparison')
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
    default:
      throw new Error(
        `Conditional logic block contains an unknown operator: ${condition}`,
      )
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
      result = compareNumbers(field, condition, value)
  }

  if (is === 'not') {
    result = !result
  }

  return result
}
