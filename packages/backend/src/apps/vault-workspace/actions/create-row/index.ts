import { parse as parseAsCsv } from 'csv-parse/sync'

import defineAction from '@/helpers/define-action'

import createTableRow from '../../common/create-table-row'

export default defineAction({
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
      description: 'Put a comma between each column.',
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

  async run($) {
    const columns = parseAsCsv($.step.parameters.columns as string, {
      columns: false,
      trim: true,
    })[0] as string[]

    const values = parseAsCsv($.step.parameters.values as string as string, {
      columns: false,
      trim: true,
    })[0] as string[]

    if (columns.length !== values.length) {
      throw new Error('The number of columns and values must be equal.')
    }

    const row: { [key: string]: string } = {}
    for (let i = 0; i < columns.length; i++) {
      row[columns[i]] = values[i]
    }

    await createTableRow($, row)
  },
})
