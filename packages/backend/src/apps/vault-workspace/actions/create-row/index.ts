import { IJSONValue } from '@plumber/types'

import { parse as parseAsCsv } from 'csv-parse/sync'

import { variableRegExp } from '../../../../helpers/compute-parameters'
import defineAction from '../../../../helpers/define-action'
import createTableRow from '../../common/create-table-row'

// FIXME (ogp-weeloong): Remove this when we have IFieldList or similar.
function substituteVariables(
  rawParameter: string,
  variables: Record<string, IJSONValue>,
): string {
  return rawParameter
    .split(variableRegExp)
    .map((part) => (part in variables ? variables[part] : part))
    .join('')
}

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
    // Parse parameters _before_ substitution as there may be commas in the
    // data.
    const columns = parseAsCsv(
      $.step.parameterDetails.valueBeforeCompute.columns as string,
      {
        columns: false,
        trim: true,
      },
    )[0] as string[]
    const values = parseAsCsv(
      $.step.parameterDetails.valueBeforeCompute.values as string,
      {
        columns: false,
        trim: true,
      },
    )[0] as string[]

    if (columns.length !== values.length) {
      throw new Error('The number of columns and values must be equal.')
    }

    const variables = $.step.parameterDetails.variables
    const row: { [key: string]: string } = {}
    for (let i = 0; i < columns.length; i++) {
      // Columns don't support variables, whew!
      row[columns[i]] = substituteVariables(values[i], variables)
    }

    await createTableRow($, row)
  },
})
