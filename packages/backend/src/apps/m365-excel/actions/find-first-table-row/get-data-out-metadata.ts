import type { IDataOutMetadata, IExecutionStep } from '@plumber/types'

import { dataOutSchema } from './schemas'

async function getDataOutMetadata(
  executionStep: IExecutionStep,
): Promise<IDataOutMetadata> {
  const { dataOut: rawDataOut } = executionStep
  if (!rawDataOut) {
    return null
  }

  const dataOut = dataOutSchema.parse(rawDataOut)
  if (!dataOut.success) {
    return null
  }

  const metadata: IDataOutMetadata = {
    rowData: Object.create(null),
  }

  for (const [key, datum] of Object.entries(dataOut.rowData)) {
    metadata.rowData[key] = {
      value: {
        type: 'text',
        label: `"${datum.columnName}" Column`,
      },
      columnName: {
        isHidden: true,
      },
    }
  }

  metadata.tableRowNumber = {
    type: 'text',
    label: 'Table Row Number',
  }
  metadata.sheetRowNumber = {
    type: 'text',
    label: 'Sheet Row Number',
  }

  return metadata
}

export default getDataOutMetadata

// Example dataOut:
// {
//   success: true,
//   rowData: {
//     '4974656D': {
//       value: 'Chicken Biscuit',
//       columnName: 'Item',
//     },
//     '556E6974205072696365': {
//       columnName: 'Unit Price',
//       value: '$5.00',
//     },
//   },
//   tableRowNumber: 2,
//   sheetRowNumber: 3
// }
