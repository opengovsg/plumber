import { IDataOutMetadata, IExecutionStep } from '@plumber/types'

import { parseS3Id } from '@/helpers/s3'

async function getDataOutMetadata(
  step: IExecutionStep,
): Promise<IDataOutMetadata> {
  const data = step.dataOut
  if (!data) {
    return null
  }

  const metadata = Object.create(null)
  for (const [key, value] of Object.entries(data)) {
    if (key === 'attachment') {
      metadata[key] = {
        label: 'Attachment',
        type: 'file',
        displayedValue: parseS3Id(value as string)?.objectName,
      }
    } else {
      metadata[key] = {
        label: key,
      }
    }
  }
  return metadata
}

export default getDataOutMetadata
