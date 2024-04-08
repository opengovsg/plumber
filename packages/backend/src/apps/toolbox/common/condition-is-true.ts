import type { IJSONObject } from '@plumber/types'

export default function conditionIsTrue(conditionArgs: IJSONObject): boolean {
  // `value` is named `text` for legacy reasons.
  const { field, is, condition, text: value } = conditionArgs

  let result: boolean
  switch (condition) {
    case 'equals':
      result = field === value
      break
    case 'gte':
      result = Number(field) >= Number(value)
      break
    case 'gt':
      result = Number(field) > Number(value)
      break
    case 'lte':
      result = Number(field) <= Number(value)
      break
    case 'lt':
      result = Number(field) < Number(value)
      break
    case 'contains':
      result = field.toString().includes(value.toString())
      break
    case 'is_empty':
      // `field` and `value` are a bit of a misnomer. They're both form fields
      // that the user inputs data into.  For "is_empty", the `value` field is
      // hidden from the user, so we only need to check `field` field.
      if (typeof field === 'string') {
        // Strings are empty if they are falsey.
        return !field
      } else {
        // All other types (e.g. 0, {}) are considered non-empty unless they are
        // null or undefined
        return field === null || field === undefined
      }
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
