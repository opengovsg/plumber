import { IDataOutMetadata, IExecutionStep } from '@plumber/types'

async function getDataOutMetadata(
  step: IExecutionStep,
): Promise<IDataOutMetadata> {
  const data = step.dataOut
  if (!data) {
    return null
  }

  const metadata = Object.create(null)
  for (const key of Object.keys(data)) {
    // the key used for data retrieved from vault workspace are converted to hex
    // to be compatible with our policy to only allow alphanumeric in template keys
    // hence we need to decode here for display on frontend
    metadata[key] = {
      label: Buffer.from(key, 'hex').toString(),
    }
  }
  return metadata
}

export default getDataOutMetadata
