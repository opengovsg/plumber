import { CsvError } from 'csv-parse/.'

import HttpError from '@/errors/http'
import StepError from '@/errors/step'

export function throwParseAsCsvError(
  err: CsvError,
  position: number,
  appName: string,
): never {
  // only three possible errors caught in DB
  switch (err.code) {
    case 'CSV_NON_TRIMABLE_CHAR_AFTER_CLOSING_QUOTE':
      throw new StepError(
        'Invalid usage of double quotes',
        'Click on set up action and check that double quotes should only be used if column or value contains commas. Use single quotes instead if necessary.',
        position,
        appName,
      )
    case 'CSV_QUOTE_NOT_CLOSED':
      throw new StepError(
        'No closing quote',
        'Click on set up action and check if an opening quote is used for a column or value, a closing quote is paired with it.',
        position,
        appName,
      )
    case 'CSV_RECORD_INCONSISTENT_FIELDS_LENGTH':
      throw new StepError(
        'Incorrect format for values field',
        'Click on set up action and check that the values field has no newline. Separate each value with a comma on the same line.',
        position,
        appName,
      )
    default:
      // return original error since uncaught
      throw err
  }
}

export function throwGetFilteredRowsError(
  err: HttpError,
  position: number,
  appName: string,
): never {
  switch (err.response.status) {
    case 400:
      // note this catches two different errors: when user doesn't select a column and when user deletes column on vault
      throw new StepError(
        'Missing lookup column',
        'Click on set up action and check that the lookup column is not empty and is present on your vault table. The column could have been accidentally deleted on your vault table, please re-create the column or select another valid lookup column.',
        position,
        appName,
        err,
      )
    case 500:
      throw new StepError(
        'Invalid lookup column used',
        'Click on set up action and ensure that you have selected a valid column instead.',
        position,
        appName,
        err,
      )
    default:
      // return original error since uncaught
      throw err
  }
}

export function throwGetColumnMappingError(
  err: HttpError,
  position: number,
  appName: string,
): never {
  switch (err.response.status) {
    case 403:
      throw new StepError(
        'Disconnected vault table',
        'Click on choose connection and ensure that your vault table is still connected. If not, please copy the new api key generated on vault and re-establish the connection on Plumber.',
        position,
        appName,
        err,
      )
    default:
      // return original error since uncaught
      throw err
  }
}
