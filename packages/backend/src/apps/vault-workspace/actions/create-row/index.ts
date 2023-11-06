import { IRawAction } from '@plumber/types'

import { parse as parseAsCsv } from 'csv-parse/sync'

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
        'Put a comma between each column. Enclose columns with double-quotes (") if it contains commas. Columns CANNOT contain double quotes.',
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
    const columns = parseAsCsv($.step.parameters.columns as string, {
      columns: false,
      trim: true,
      relaxQuotes: true,
    })[0] as string[]

    const values = parseAsCsv($.step.parameters.values as string as string, {
      columns: false,
      trim: true,
      relaxQuotes: true,
    })[0] as string[]

    if (columns.length !== values.length) {
      throw new Error('The number of columns and values must be equal.')
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
