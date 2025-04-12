import type { IDataOutMetadata, IExecutionStep } from '@plumber/types'

import { dataOutSchema } from './schemas'

async function getDataOutMetadata(
  executionStep: IExecutionStep,
): Promise<IDataOutMetadata> {
  const { dataOut: rawDataOut } = executionStep
  if (!rawDataOut) {
    return null
  }

  // Parse the data first to get proper type information
  const dataOut = dataOutSchema.parse(rawDataOut)

  const metadata: IDataOutMetadata = {
    rowsFound: {
      label: 'Number of rows found',
      order: 2,
    },
  }

  if (dataOut.rowsFound === 0) {
    return metadata
  }

  metadata.rows = {
    label: 'List of row(s) found',
    displayedValue: `Preview ${dataOut.rowsFound} row(s)`,
    type: 'array',
    order: 1,
  }

  const columnMetadata: IDataOutMetadata = {}
  if ('columns' in dataOut) {
    /**
     * NOTE: Excel does not allow duplicate column names in tables,
     * don't need to worry about using column names as the unique identifier.
     */
    Object.entries(dataOut.columns).forEach(([name, { order }]) => {
      columnMetadata[name] = {
        id: { type: 'hidden' },
        value: {
          label: name,
          order: order ? order + 2 : null,
        },
        order: { type: 'hidden' },
      }
    })
  }

  return { ...metadata, columns: columnMetadata }
}

export default getDataOutMetadata

// Example dataOut: {
//   // rows is a stringified array of objects, where each object is a row of data
//   rows: '[{"id": "0-2","tableRowIndex":0,"sheetRowNumber":2,"row":{"436f6c756D6E31":{"value":"abc","columnName":"Column1"},"436F6C756D6E32":{"value":"123","columnName":"Column2"}}},{"id": "3-5","tableRowIndex":3,"sheetRowNumber":5,"row":{"436F6C756D6E31":{"value":"abc","columnName":"Column1"},"436F6C756D6E32":{"value":"111","columnName":"Column2"}}}]',
//   columns: {"Column1": {"id": "Column1", "order":1, value: "Column1"}, "Column2": {"id": "Column2", "order":2, value: "Column2"}},
//   rowsFound: 2
// }
