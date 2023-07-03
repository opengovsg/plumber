import type { PutObjectCommandInput } from '@aws-sdk/client-s3'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

import appConfig from '@/config/app'

const s3Client = new S3Client({
  region: appConfig.s3Region,
  ...(appConfig.isDev && {
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY,
    },
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
  }),
})

export interface PlumberS3IdData {
  bucket: string
  objectKey: string
  objectName: string
}

/**
 * Extracts object info from a Plumber S3 ID.
 *
 * @returns Details about the S3 object if the input satisfies the Plumber S3
 * ID format; null otherwise.
 */
export function parsePlumberS3Id(id: string): PlumberS3IdData | null {
  if (!id.startsWith('plumber-s3:')) {
    return null
  }

  const [_prefix, bucket, ...objectKeyBits] = id.split(':')
  const objectKey = objectKeyBits.join(':')

  if (!bucket || objectKey.length == 0) {
    return null
  }

  return {
    bucket,
    objectKey,
    objectName: objectKey.split('/').pop(),
  }
}

/**
 * Puts a object into our S3 store and returns a *Plumber S3 ID* representing
 * the stored object.
 *
 * *Note 1:* A Plumber S3 ID has the form `plumber-s3:bucketName:objectKey`,
 * where `objectKey` is a `/`-delimited string whose last segment is the object
 * name - see {@link parsePlumberS3Id}.
 *
 * *Note 2:* This doesn't validate `objectKey`; the caller is expected to make
 * sure it's formatted correctly.
 */
export async function putObject(
  bucket: string,
  objectKey: string,
  body: PutObjectCommandInput['Body'],
  metadata: PutObjectCommandInput['Metadata'] | null,
): Promise<string> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: body,
      Metadata: metadata,
    }),
  )
  return `plumber-s3:${bucket}:${objectKey}`
}
