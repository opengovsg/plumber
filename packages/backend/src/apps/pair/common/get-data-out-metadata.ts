import {
  IDataOutMetadata,
  IDataOutMetadatum,
  IExecutionStep,
} from '@plumber/types'

import { sanitizeOutputFieldName } from './schema'

async function getDataOutMetadata(
  executionStep: IExecutionStep,
): Promise<IDataOutMetadata> {
  const { dataOut } = executionStep
  if (!dataOut) {
    return null
  }

  const rawResponseFields = executionStep.step?.parameters?.responseFields as
    | Array<{ fieldName: string }>
    | undefined

  const orderedKeys = Array.isArray(rawResponseFields)
    ? rawResponseFields.map((f) => sanitizeOutputFieldName(f.fieldName))
    : Object.keys(dataOut)

  const metadata = orderedKeys.reduce((acc, key, index) => {
    if (key in dataOut) {
      acc[key] = {
        label: key.replace(/_/g, ' '),
        type: 'ai_response',
        order: index,
      }
    }
    return acc
  }, {} as Record<string, IDataOutMetadatum>)

  return metadata
}

export default getDataOutMetadata
