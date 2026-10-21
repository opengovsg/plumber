import { COMMON_S3_BUCKET, getObjectFromS3Id, parseS3Id } from '@/helpers/s3'

function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    pdf: 'application/pdf',
  }
  const normalizedExtension = extension.toLowerCase()
  const mimeType = mimeTypes[normalizedExtension]
  if (!mimeType) {
    throw new Error(`${extension} files are not supported`)
  }
  return mimeType
}

async function getImageContent(s3Id: string, flowId: string) {
  /**
   * `getObjectFromS3Id` trusts the bucket embedded in `s3Id` as-is; the
   * `image` step parameter is user-controlled, so pin it to the app's own
   * bucket before the flowId metadata check even runs (GTA-119-009).
   */
  if (parseS3Id(s3Id)?.bucket !== COMMON_S3_BUCKET) {
    throw new Error(`Invalid S3 ID: ${s3Id}`)
  }

  const s3Object = await getObjectFromS3Id(s3Id, { flowId })
  const base64String = Buffer.from(s3Object.data).toString('base64')
  const extension = s3Object.name.split('.').pop() || ''
  const mimeType = getMimeType(extension)

  if (mimeType === 'application/pdf') {
    return [
      {
        type: 'file' as const,
        data: `data:${mimeType};base64,${base64String}`,
        mediaType: 'application/pdf',
      },
      {
        type: 'text' as const,
        text: 'Process this document and extract the relevant information specified in the schema.',
      },
    ]
  }

  return [
    {
      type: 'image' as const,
      image: `data:${mimeType};base64,${base64String}`,
    },
  ]
}

export { getImageContent, getMimeType }
