import { IDataOutMetadata, IExecutionStep } from '@plumber/types'

import { getPrompts } from '../../common/get-prompts'

async function getDataOutMetadata(
  executionStep: IExecutionStep,
): Promise<IDataOutMetadata> {
  const { dataOut, stepId } = executionStep

  if (!dataOut || !dataOut.fields) {
    return null
  }

  const prompts = await getPrompts(stepId)

  const fieldsMetadata: Record<string, IDataOutMetadata> = {}
  Object.keys(dataOut.fields).forEach((key) => {
    const index = parseInt(key.split('additionalProp')[1])
    const fieldName = prompts[index]
    fieldsMetadata[key] = {
      label: fieldName,
    }
  })

  const otherMetadata: Record<string, IDataOutMetadata> = {}
  Object.keys(dataOut).forEach((key) => {
    if (key !== 'fields') {
      otherMetadata[key] = {
        isHidden: true,
      }
    }
  })

  return {
    fields: fieldsMetadata,
    ...otherMetadata,
  }
}

export default getDataOutMetadata
