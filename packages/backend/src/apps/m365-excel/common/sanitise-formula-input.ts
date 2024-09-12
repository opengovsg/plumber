const DISALLOWED_STARTING_CHARACTERS = ['=', '+', '-', '@', '0x09', '0x0D']
const DATA_EXFILTRATION_FORMULAS = ['HYPERLINK', 'WEBSERVICE', 'IMPORTDATA']
// Either deprecated or have to be used in external scripts
// const SYSTEM_COMMAND_EXECUTION_FORMULAS = ['CMD', 'EXEC', 'DDE', 'SHELL']

// Define denylist that could be part of a malicious formula
const BLACKLISTED_FORMULAS_REGEX = new RegExp(
  `${DATA_EXFILTRATION_FORMULAS.join('|')}\\(`,
  'i',
)

/**
 * This function is used for createTableRow and updateTableRow in excel.
 * It helps to sanitise the user input that could contain malicious formulas
 * and returns a text back to excel when found.
 *
 * Based on the documentation of OWASP for CSV Injection
 * https://owasp.org/www-community/attacks/CSV_Injection
 * Note that excel formulas are case-insensitive
 */
export function sanitiseInputValue(value: string): string {
  // sanity check
  if (!value || value.length === 0) {
    return value
  }

  const shouldSanitiseInput =
    DISALLOWED_STARTING_CHARACTERS.includes(value.trimStart().charAt(0)) &&
    BLACKLISTED_FORMULAS_REGEX.test(value)

  return shouldSanitiseInput ? `'${value}` : value
}
