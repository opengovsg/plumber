import type { IDataOutMetadata, IExecutionStep } from '@plumber/types'

async function getDataOutMetadata(
  executionStep: IExecutionStep,
): Promise<IDataOutMetadata> {
  const { dataOut: rawDataOut } = executionStep
  if (!rawDataOut) {
    return null
  }

  const metadata: IDataOutMetadata = {
    success: {
      label: 'Is row created?',
    },
  }

  metadata.sheetRowNumber = {
    type: 'text',
    label: 'Sheet row number',
  }

  return metadata
}

export default getDataOutMetadata

// Example dataOut:
// {
//   success: true,
//   sheetRowNumber: 3
// }
