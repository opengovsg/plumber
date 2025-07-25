import { IDataOutMetadata, IExecutionStep } from '@plumber/types'

import logger from '@/helpers/logger'

import { dataOutSchema } from './schema'

async function getDataOutMetadata(
  executionStep: IExecutionStep,
): Promise<IDataOutMetadata> {
  const { dataOut: rawDataOut } = executionStep

  if (!rawDataOut) {
    return null
  }
  const dataOut = dataOutSchema.safeParse(rawDataOut)
  if (!dataOut.success) {
    logger.error({
      message: 'Invalid data out schema for tiles find multiple rows action',
      executionId: executionStep.executionId,
      action: 'find-multiple-rows',
    })
    return null
  }

  const metadata: IDataOutMetadata = {
    data: {
      label: 'Row(s) found',
      displayedValue: `Preview ${dataOut.data.rowsFound} row(s)`,
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
