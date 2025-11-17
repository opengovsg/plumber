import { IDataOutMetadata, IExecutionStep } from '@plumber/types'

import { dataOutSchema } from './schema'

async function getDataOutMetadata(
  step: IExecutionStep,
): Promise<IDataOutMetadata> {
  const { dataOut: rawDataOut } = step

  if (!rawDataOut) {
    return null
  }

  dataOutSchema.parse(rawDataOut)

  const metadata: IDataOutMetadata = {
    data: {
      response: {
        content: {
          label: 'Response',
        },
      },
    },
  }

  // Recursively hide all fields except the ones explicitly defined in metadata
  function hideAllFields(obj: any, metadataPath: any = {}) {
    const result: any = { ...metadataPath }

    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      Object.entries(obj).forEach(([key, value]) => {
        // If this key is already defined in metadata, recurse into it
        if (metadataPath[key]) {
          result[key] = hideAllFields(value, metadataPath[key])
        } else {
          // Otherwise, hide this field
          result[key] = { isHidden: true }
        }
      })
    }

    return result
  }

  const finalMetadata = hideAllFields(rawDataOut.data, metadata.data)

  return {
    data: finalMetadata,
  }
}

export default getDataOutMetadata
