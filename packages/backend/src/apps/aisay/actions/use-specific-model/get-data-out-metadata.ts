import { IDataOutMetadata, IExecutionStep } from '@plumber/types'

import { generateFieldMetadata } from './generate-field-metadata'

async function getDataOutMetadata(
  executionStep: IExecutionStep,
): Promise<IDataOutMetadata> {
  const { dataOut } = executionStep

  if (!dataOut) {
    return null
  }

  const fieldsMetadata = generateFieldMetadata(dataOut.fields)

  return {
    quota: {
      label: 'Quota',
      type: 'doNotDisplay',
    },
    documentType: {
      label: 'Document Type',
    },
    confidence: {
      label: 'Confidence',
    },
    fields: fieldsMetadata,
  }
}

export default getDataOutMetadata
