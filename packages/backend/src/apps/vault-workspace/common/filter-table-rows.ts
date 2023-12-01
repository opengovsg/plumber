import { IGlobalVariable } from '@plumber/types'

import { generateStepError } from '@/helpers/generate-step-error'

import { VAULT_ID } from './constants'
import { getColumnMapping } from './get-column-mapping'
import { throwGetFilteredRowsError } from './throw-errors'

const filterTableRows = async (
  $: IGlobalVariable,
  columnName: string,
  value: string,
): Promise<{ [key: string]: any }> => {
  const response = await $.http
    .get('/api/tables', {
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
    .catch((err): never => {
      throwGetFilteredRowsError(err, $.step.position, $.app.name)
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

  try {
    for (const name in rawData) {
      if (name === VAULT_ID) {
        row[name] = rawData[name]
      } else {
        // keys are converted to hex here to satisfy our requirement for template
        // keys to be alphanumeric, and will be decoded by getDataOutMetadata before
        // displayed on frontend
        const key = Buffer.from(mapping[name]).toString('hex')
        row[key] = rawData[name]
      }
    }
  } catch (err) {
    if (err instanceof TypeError) {
      const stepErrorName = 'Undefined column name in Vault'
      const stepErrorSolution =
        'Your vault table has an undefined column due to a bug. Please create a new vault table to be used.'
      throw generateStepError(
        stepErrorName,
        stepErrorSolution,
        $.step.position,
        $.app.name,
      )
    }
    throw err
  }

  return {
    ...row,
    _metadata: {
      success: true,
      rowsFound: response.data.rows.length,
      keysEncoded: true,
    },
  }
}

export default filterTableRows
