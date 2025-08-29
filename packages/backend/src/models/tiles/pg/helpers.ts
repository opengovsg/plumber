// This regex is used to validate that a string is a valid number
// It matches strings that start with an optional minus sign, followed by an optional zero,
// or any number from 1 to 9 followed by any number of digits, optionally followed by a decimal point and any number of digits.
// Examples: "123", "-456", "0.789", "-0.123", "123.456", "-456.789"

export const VALID_NUMBER_REGEX_STRING = '^-?(0|[1-9]\\d*)(\\.\\d+)?$'
export const VALID_NUMBER_REGEX = new RegExp(VALID_NUMBER_REGEX_STRING)

export function isValidNumericString(value: string): boolean {
  return VALID_NUMBER_REGEX.test(value) && !isNaN(+value)
}
