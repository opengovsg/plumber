import { IDataOutMetadata, IExecutionStep } from '@plumber/types'

import { VAULT_ID } from '../../common/constants'

async function getDataOutMetadata(
  step: IExecutionStep,
): Promise<IDataOutMetadata> {
  const data = step.dataOut
  if (!data) {
    return null
  }
  const _metadata = data?._metadata as Record<string, any>
  if (!_metadata.keysEncoded) {
    return null
  }

  const metadata = Object.create(null)
  for (const key of Object.keys(data)) {
    if (key === VAULT_ID) {
      continue
    } else if (key === '_metadata') {
      metadata['_metadata.keysEncoded'] = {
        isHidden: true,
      }
    }
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
