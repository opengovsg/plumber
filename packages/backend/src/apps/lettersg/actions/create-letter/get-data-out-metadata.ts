import { IDataOutMetadata, IExecutionStep } from '@plumber/types'

import { parseS3Id } from '@/helpers/s3'

import { dataOutSchema } from './schema'

async function getDataOutMetadata(
  step: IExecutionStep,
): Promise<IDataOutMetadata> {
  const { dataOut: rawDataOut } = step
  if (!rawDataOut) {
    return null
  }
  const dataOut = dataOutSchema.parse(rawDataOut)
  const metadata = Object.create(null)
  for (const [key, value] of Object.entries(dataOut)) {
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
