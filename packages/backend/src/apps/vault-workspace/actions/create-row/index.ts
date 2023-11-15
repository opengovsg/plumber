import { IRawAction } from '@plumber/types'

import { parse as parseAsCsv } from 'csv-parse/sync'

import { generateStepError } from '@/helpers/generate-step-error'

import createTableRow from '../../common/create-table-row'
import {
  escapeSpecialChars,
  unescapeSpecialChars,
} from '../../common/escape-characters'

const action: IRawAction = {
  name: 'Create row',
  key: 'createRow',
  description: 'Creates a new row in Vault table.',
  arguments: [
    {
      label: 'Columns',
      key: 'columns',
      type: 'string' as const,
      required: true,
      variables: false,
      description:
        'Put a comma between each column. Enclose columns with double-quotes (") if it contains commas. Columns can contain double quotes, but use single quotes if problems arise.',
    },
    {
      label: 'Values',
      key: 'values',
      type: 'string' as const,
      required: true,
      variables: true,
      description: 'Put a comma between each value.',
    },
  ],
  preprocessVariable: (key, value) => {
    if (key !== 'values') {
      return value
    }
    if (typeof value !== 'string') {
      return value
    }
    // url encode commas and double quotes
    return escapeSpecialChars(value)
  },

  async run($) {
    let columns, values
    try {
      columns = parseAsCsv($.step.parameters.columns as string, {
        columns: false,
        trim: true,
        relaxQuotes: true,
      })[0] as string[]

      values = parseAsCsv($.step.parameters.values as string as string, {
        columns: false,
        trim: true,
        relaxQuotes: true,
      })[0] as string[]
    } catch (err) {
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
      throw generateStepError(
        stepErrorName,
        stepErrorSolution,
        $.step.position,
        $.app.name,
      )
    }

    if (values === undefined) {
      const stepErrorName = 'Undefined values field'
      const stepErrorSolution =
        'Click on set up action and check that the values field is not empty. This is most likely because you are using a single variable that could be empty.'
      throw generateStepError(
        stepErrorName,
        stepErrorSolution,
        $.step.position,
        $.app.name,
      )
    }

    if (columns.length !== values.length) {
      const stepErrorName = 'Unequal number of columns and values'
      const stepErrorSolution =
        'Click on set up action and check that every column or value is separated by a comma when intended. Then, verify that the number of columns and values are exactly equal in quantity.'
      throw generateStepError(
        stepErrorName,
        stepErrorSolution,
        $.step.position,
        $.app.name,
      )
    }

    const row: { [key: string]: string } = {}
    for (let i = 0; i < columns.length; i++) {
      const columnName = columns[i]
      const rowValue = unescapeSpecialChars(values[i])
      row[columnName] = rowValue
    }

    await createTableRow($, row)
  },
}

export default action
