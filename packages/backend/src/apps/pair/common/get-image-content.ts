import { getObjectFromS3Id } from '@/helpers/s3'

function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    pdf: 'application/pdf',
  }
  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream'
}

async function getImageContent(s3Id: string) {
  const S3Object = await getObjectFromS3Id(s3Id)
  const base64String = Buffer.from(S3Object.data).toString('base64')
  const extension = S3Object.name.split('.').pop() || ''
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
