import { IRawAction } from '@plumber/types'

import { parse as parseAsCsv } from 'csv-parse/sync'

import { generateStepError } from '@/helpers/generate-step-error'

import createTableRow from '../../common/create-table-row'
import {
  escapeSpecialChars,
  unescapeSpecialChars,
} from '../../common/escape-characters'
import { throwParseAsCsvError } from '../../common/throw-errors'

const action: IRawAction = {
  name: 'Create row',
  key: 'createRow',
  description: 'Creates a new row in Vault Workspace table.',
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
      throwParseAsCsvError(err, $.step.position, $.app.name)
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
