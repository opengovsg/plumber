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

// Define denylist that could start a malicious formula
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
  const combinedRegex = new RegExp(BLACKLISTED_FORMULAS.join('|'), 'gi')
  return input.replace(combinedRegex, (match) => `'${match}`)
}
