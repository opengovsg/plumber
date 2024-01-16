import { IRawAction } from '@plumber/types'

import { parse as parseAsCsv } from 'csv-parse/sync'

import StepError from '@/errors/step'

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
      throw new StepError(
        'Undefined values field',
        'Click on set up action and check that the values field is not empty. This is most likely because you are using a single variable that could be empty.',
        $.step.position,
        $.app.name,
      )
    }

    if (columns.length !== values.length) {
      throw new StepError(
        'Unequal number of columns and values',
        'Click on set up action and check that every column or value is separated by a comma when intended. Then, verify that the number of columns and values are exactly equal in quantity.',
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
