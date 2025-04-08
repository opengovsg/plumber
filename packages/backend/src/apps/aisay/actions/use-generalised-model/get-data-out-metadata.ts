import { IDataOutMetadata, IExecutionStep } from '@plumber/types'

import { getInfoToExtract } from '../../common/info-to-extract'

async function getDataOutMetadata(
  executionStep: IExecutionStep,
): Promise<IDataOutMetadata> {
  const { dataOut, stepId } = executionStep

  if (!dataOut || !dataOut.fields) {
    return null
  }

  const infoToExtract = await getInfoToExtract(stepId)

  const fieldsMetadata: Record<string, IDataOutMetadata> = {}
  Object.keys(dataOut.fields).forEach((key) => {
    const index = parseInt(key.split('additionalProp')[1])
    const fieldName = infoToExtract[index]
    fieldsMetadata[key] = {
      label: fieldName,
    }
  })

  return {
    quota: {
      label: 'Quota',
      type: 'doNotDisplay',
    },
    fields: fieldsMetadata,
  }
}

export default getDataOutMetadata
