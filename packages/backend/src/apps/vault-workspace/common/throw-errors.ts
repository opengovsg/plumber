import { CsvError } from 'csv-parse/.'

import HttpError from '@/errors/http'
import {
  generateHttpStepError,
  generateStepError,
} from '@/helpers/generate-step-error'

export function throwParseAsCsvError(
  err: CsvError,
  position: number,
  appName: string,
): never {
  // only three possible errors caught in DB
  let stepErrorName, stepErrorSolution
  if (err.code === 'CSV_NON_TRIMABLE_CHAR_AFTER_CLOSING_QUOTE') {
    stepErrorName = 'Invalid usage of double quotes'
    stepErrorSolution =
      'Click on set up action and check that double quotes should only be used if column or value contains commas. Use single quotes instead if necessary.'
  } else if (err.code === 'CSV_QUOTE_NOT_CLOSED') {
    stepErrorName = 'No closing quote'
    stepErrorSolution =
      'Click on set up action and check if an opening quote is used for a column or value, a closing quote is paired with it.'
  } else if (err.code === 'CSV_RECORD_INCONSISTENT_FIELDS_LENGTH') {
    stepErrorName = 'Incorrect format for values field'
    stepErrorSolution =
      'Click on set up action and check that the values field has no newline. Separate each value with a comma on the same line.'
  } else {
    // return original error since uncaught
    throw err
  }
  throw generateStepError(stepErrorName, stepErrorSolution, position, appName)
}

export function throwGetFilteredRowsError(
  err: HttpError,
  position: number,
  appName: string,
): never {
  let stepErrorSolution
  if (err.response.status === 400) {
    // note this catches two different errors: when user doesn't select a column and when user deletes column on vault
    stepErrorSolution =
      'Click on set up action and check that the lookup column is not empty and is present on your vault table. The column could have been accidentally deleted on your vault table, please re-create the column or select another valid lookup column.'
  } else if (err.response.status === 500) {
    // invalid lookup column used
    stepErrorSolution =
      'Click on set up action and ensure that you have selected a valid column instead.'
  } else {
    // return original error since uncaught
    throw err
  }
  throw generateHttpStepError(err, stepErrorSolution, position, appName)
}

export function throwGetColumnMappingError(
  err: HttpError,
  position: number,
  appName: string,
): never {
  let stepErrorSolution
  if (err.response.status === 403) {
    stepErrorSolution =
      'Click on choose connection and ensure that your vault table is still connected. If not, please copy the new api key generated on vault and re-establish the connection on Plumber.'
  } else {
    // return original error since uncaught
    throw err
  }
  throw generateHttpStepError(err, stepErrorSolution, position, appName)
}
