import type { IDataOutMetadata, IExecutionStep } from '@plumber/types'

import type { DataOut } from './data-out'

async function getDataOutMetadata(
  executionStep: IExecutionStep,
): Promise<IDataOutMetadata> {
  const { dataOut: rawDataOut } = executionStep
  if (!rawDataOut) {
    return null
  }

  const dataOut = rawDataOut as DataOut
  const metadata: IDataOutMetadata = {
    results: [],
  }

  for (const [index, result] of dataOut.results.entries()) {
    metadata.results.push({
      cellAddress: {
        type: 'text',
        label: `Cell ${index + 1}'s Address`,
      },
      cellValue: {
        text: 'text',
        label: `Cell ${index + 1}'s (${result.cellAddress}) Value`,
      },
    })
  }

  return metadata
}

export default getDataOutMetadata

// Example dataOut:
// {
//     results: [
//       {
//         cellAddress: 'A2',
//         cellValue: '123',
//       },
//       {
//         cellAddress: 'BA99',
//         cellValue: 'topkek',
//       },
//     ],
//   }
