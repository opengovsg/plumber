import { IDataOutMetadata, IExecutionStep } from '@plumber/types'

import { generateColumnNameMetadata } from '../../common/column-name-metadata'
import { UpdateRowOutput } from '../../types'

/**
 * Maps column ids to column names since there is a possibility that column names could be the same
 * and/or contains spaces
 */
async function getDataOutMetadata(
  executionStep: IExecutionStep,
): Promise<IDataOutMetadata> {
  const { dataOut } = executionStep
  if (!dataOut?.row || typeof dataOut.row !== 'object') {
    return null
  }

  const metadata: IDataOutMetadata = {
    rowId: {
      label: 'Row ID',
    },
  }
  const rowData = (dataOut as UpdateRowOutput).row
  const columnNameMetadata = await generateColumnNameMetadata(rowData)

  return { ...metadata, ...columnNameMetadata }
}

export default getDataOutMetadata
