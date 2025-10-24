import { IDataOutMetadata, IExecutionStep } from '@plumber/types'

import { responseSchema } from './schema'

async function getDataOutMetadata(
  step: IExecutionStep,
): Promise<IDataOutMetadata> {
  const { dataOut: rawDataOut } = step
  if (!rawDataOut) {
    return null
  }

  responseSchema.parse(rawDataOut)

  const defaultMetadata = {
    data: {
      uuid: {
        label: 'Case UUID',
      },
      caseRef: {
        label: 'Case ref',
      },
    },
  }

  return defaultMetadata
}

export default getDataOutMetadata
