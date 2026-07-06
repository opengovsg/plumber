import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

import { archivalConfig } from './config'

export const archiveS3Client = new S3Client({
  region: 'ap-southeast-1',
  ...(archivalConfig.isDev && {
    credentials: {
      accessKeyId: archivalConfig.s3AccessKey!,
      secretAccessKey: archivalConfig.s3SecretKey!,
    },
    endpoint: archivalConfig.s3Endpoint,
    forcePathStyle: true,
  }),
})

type PutArchiveObjectParams = {
  s3Client: S3Client
  bucket: string
  key: string
  body: Buffer | string
  contentType: string
  metadata?: Record<string, string>
}

export async function putArchiveObject({
  s3Client,
  bucket,
  key,
  body,
  contentType,
  metadata,
}: PutArchiveObjectParams): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: metadata,
    }),
  )
}
