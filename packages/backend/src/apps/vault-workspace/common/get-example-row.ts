import { IGlobalVariable } from '@plumber/types'

import { getColumnMapping } from './get-column-mapping'

const VAULT_ID = 'vault_id'

const getExampleRow = async (
  $: IGlobalVariable,
): Promise<{ [key: string]: string }> => {
  const response = await $.http.get('/api/tables')

  if (response.data.rows.length < 1) {
    throw new Error('Row not found')
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

  return row
}

export default getExampleRow
