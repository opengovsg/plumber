import { IGlobalVariable } from '@plumber/types'

import { VAULT_ID } from './constants'
import { getColumnMapping } from './get-column-mapping'

const filterTableRows = async (
  $: IGlobalVariable,
  columnName: string,
  value: string,
): Promise<{ [key: string]: any }> => {
  const response = await $.http.get('/api/tables', {
    data: {
      filter: [
        {
          columnName,
          type: 'EQ',
          value,
        },
      ],
    },
  })

  if (response.data.rows.length < 1) {
    return {
      _metadata: {
        success: false,
        rowsFound: 0,
      },
    }
  }
  // NOTE: if more than 1 row, just first row
  const rawData: { [key: string]: string } = response.data.rows[0]

  // to replace column name with alias
  const mapping = await getColumnMapping($)
  const row: { [key: string]: string } = {}
  for (const name in rawData) {
    if (name === VAULT_ID) {
      row[name] = rawData[name]
    } else {
      row[mapping[name]] = rawData[name]
    }
  }

  return {
    ...row,
    _metadata: {
      success: true,
      rowsFound: response.data.rows.length,
    },
  }
}

export default filterTableRows
