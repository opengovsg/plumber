import type { IJSONValue } from '@plumber/types'

const DATA_EXFILTRATION_FORMULAS = [
  'HYPERLINK',
  'WEBSERVICE',
  'IMPORTDATA',
  'RTD',
]

const SYSTEM_COMMAND_EXECUTION_FORMULAS = ['CMD', 'EXEC', 'DDE', 'SHELL']

const SENSITIVE_DATA_EXPOSURE_FORMULAS = [
  'GETPIVOTDATA',
  'INDIRECT',
  'OFFSET',
  'CELL',
  'VLOOKUP',
  'HLOOKUP',
]

// Define denylist that could be part of a malicious formula
const BLACKLISTED_FORMULAS = [
  ...DATA_EXFILTRATION_FORMULAS,
  ...SYSTEM_COMMAND_EXECUTION_FORMULAS,
  ...SENSITIVE_DATA_EXPOSURE_FORMULAS,
]

/**
 * Based on the documentation of OWASP for CSV Injection
 * https://owasp.org/www-community/attacks/CSV_Injection
 * Note that excel formulas are case-insensitive
 */
export function sanitiseFormulaInput(input: string): string {
  // Regex to match blacklisted formulas
  const combinedRegex = new RegExp(`${BLACKLISTED_FORMULAS.join('|')}\\(`, 'gi')
  return input.replace(combinedRegex, (match) => `'${match}`)
}

/**
 * Note: This is called full input because it could consist of
 * multiple sanitised variables and normal text input.
 * Removes leading apostrophes only from sanitised formulas in each variable.
 */
export function unsanitiseFullInput(input: string): string {
  // Regex to match blacklisted formulas with leading apostrophe
  const combinedRegex = new RegExp(
    `'\\b(${BLACKLISTED_FORMULAS.join('|')})\\b\\(`,
    'gi',
  )

  // Remove leading apostrophes in sanitised formulas
  return input.replace(combinedRegex, (match) => {
    return match.slice(1)
  })
}

/**
 * This function is used for createTableRow and updateTableRow in excel.
 * It helps to unsanitise the user input that could contain malicious formulas
 * and returns a text back to excel when found.
 *
 * Caveat: The only issue with this approach is that if an user types in a
 * text input with a leading apostrophe e.g. 'OFFSET(...), it will unsanitise it
 * even though it was not a variable but this is okay because it is considered an
 * invalid input (not a proper excel formula) and regardless, when this is detected,
 * a leading apostrophe will be added to the entire input to transform it
 * into a text as a safeguard.
 */
export function processInputValue(value: IJSONValue): string {
  const storedValue = String(value)
  const unsanitisedValue = unsanitiseFullInput(storedValue)
  return storedValue === unsanitisedValue ? storedValue : `'${unsanitisedValue}`
}
