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
      label: 'No. of rows found',
    },
  }

  if (dataOut.rowsFound === 0) {
    return metadata
  }

  // At this point TypeScript knows we're in the second branch of the union
  metadata.rows = {
    label: 'Data rows',
    displayedValue: `${dataOut.rowsFound} rows`,
  }

  const columnMetadata: IDataOutMetadata = []
  if ('columns' in dataOut) {
    dataOut.columns.forEach((column: string) => {
      columnMetadata.push({
        label: column,
        displayedValue: '',
      })
    })
  }

  return { ...metadata, columns: columnMetadata }
}

export default getDataOutMetadata

// Example dataOut: {
//   // rows is a stringified array of objects, where each object is a row of data
//   rows: '[{"tableRowIndex":0,"sheetRowNumber":2,"row":{"436f6c756D6E31":{"value":"abc","columnName":"Column1"},"436F6C756D6E32":{"value":"123","columnName":"Column2"}}},{"tableRowIndex":3,"sheetRowNumber":5,"row":{"436F6C756D6E31":{"value":"abc","columnName":"Column1"},"436F6C756D6E32":{"value":"111","columnName":"Column2"}}}]',
//   columns: [ 'Column1', 'Column2' ],
//   rowsFound: 2
// }
