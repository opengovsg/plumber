import {
  IDataOutMetadata,
  IDataOutMetadatum,
  IExecutionStep,
} from '@plumber/types'

async function getDataOutMetadata(
  executionStep: IExecutionStep,
): Promise<IDataOutMetadata> {
  const { dataOut } = executionStep
  if (!dataOut) {
    return null
  }

  const metadata = Object.keys(dataOut).reduce((acc, key) => {
    acc[key] = {
      label: key.replace(/_/g, ' '),
      type: 'ai_response',
    }
    return acc
  }, {} as Record<string, IDataOutMetadatum>)

  return metadata
}

export default getDataOutMetadata
