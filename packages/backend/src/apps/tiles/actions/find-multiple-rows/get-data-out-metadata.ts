import { IDataOutMetadata, IExecutionStep } from '@plumber/types'

import { TileColumnMetadata } from '../../types'

import { dataOutSchema } from './schema'

async function getDataOutMetadata(
  executionStep: IExecutionStep,
): Promise<IDataOutMetadata> {
  const { dataOut: rawDataOut } = executionStep

  if (!rawDataOut) {
    return null
  }
  const dataOut = dataOutSchema.parse(rawDataOut)

  const metadata: IDataOutMetadata = {
    rows: {
      label: 'List of row(s) found',
      displayedValue: `Preview ${dataOut.rowsFound} row(s)`,
      type: 'array',
      order: 1,
    },
    rowsFound: {
      label: 'Number of rows found',
      order: 2,
    },
  }

  const columnMetadata: IDataOutMetadata = []
  if (dataOut.columns) {
    dataOut.columns.forEach((column: TileColumnMetadata) => {
      columnMetadata.push({
        id: { isHidden: true },
        name: { isHidden: true },
        value: { label: column.name },
      })
    })
  }
  return { ...metadata, columns: columnMetadata }
}

export default getDataOutMetadata
