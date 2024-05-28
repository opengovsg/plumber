import { type IJSONValue } from '@plumber/types'

/**
 * Note this is for dropdown validation with either yes/no or true/false
 * Value should be string because dropdown option has to be a string
 * Value could be boolean due to old code referencing it as a boolean
 */
export function convertBinaryDropdown(value: IJSONValue | undefined): boolean {
  if (value === undefined) {
    return false
  }
  if (typeof value === 'string') {
    return value === 'yes'
  }
  return Boolean(value)
}
