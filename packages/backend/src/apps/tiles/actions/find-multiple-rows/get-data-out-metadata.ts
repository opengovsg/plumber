import { IDataOutMetadata, IExecutionStep } from '@plumber/types'

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
    data: {
      label: 'List of row(s) found',
      displayedValue: `Preview ${dataOut.rowsFound} row(s)`,
      type: 'table',
      order: 1,
    },
    rowsFound: {
      label: 'Number of rows found',
      order: 2,
    },
  }

  return { ...metadata }
}

export default getDataOutMetadata
