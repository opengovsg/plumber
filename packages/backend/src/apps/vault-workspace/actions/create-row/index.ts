import defineAction from '../../../../helpers/define-action'
import createTableRow from '../../common/create-table-row'

// NOTE: this is just demo code, we are not using action yet.
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
    const rawColumnData = $.step.parameters.columns as string
    const columns = rawColumnData.split(',').map((each) => {
      return each.trim()
    })

    const rawValueData = $.step.parameters.values as string
    const values = rawValueData.split(',')

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
