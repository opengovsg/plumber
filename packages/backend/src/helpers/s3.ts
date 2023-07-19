import type { PutObjectCommandInput } from '@aws-sdk/client-s3'
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

import appConfig from '@/config/app'

export const COMMON_S3_BUCKET = `plumber-${appConfig.appEnv}-common-bucket`

const s3Client = new S3Client({
  region: 'ap-southeast-1',
  ...(appConfig.isDev && {
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY,
    },
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
  }),
})

export interface S3IdData {
  bucket: string
  objectKey: string
  objectName: string
}

/**
 * Extracts object info from a S3 ID.
 *
 * @returns Details about the S3 object if the input satisfies the S3 ID
 * format; null otherwise.
 */
export function parseS3Id(id: string): S3IdData | null {
  if (!id.startsWith('s3:')) {
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
 * Puts a object into our S3 store and returns a *S3 ID* representing
 * the stored object.
 *
 * *Note 1:* A S3 ID has the form `s3:bucketName:objectKey`, where `objectKey`
 * is a `/`-delimited string whose last segment is the object name (see
 * the parseId function).
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
  return `s3:${bucket}:${objectKey}`
}

export interface S3Object {
  name: string
  data: Uint8Array
}

/**
 * Obtains the object described by a Plumber S3 ID.
 *
 * If the ID has an invalid format, or we don't receive an object body, this
 * throws an `Error`.
 */
export async function getObjectFromS3Id(id: string): Promise<S3Object> {
  const idData = parseS3Id(id)
  if (!idData) {
    throw new Error(`Invalid S3 ID: ${id}`)
  }

  const objectData = (
    await s3Client.send(
      new GetObjectCommand({ Bucket: idData.bucket, Key: idData.objectKey }),
    )
  ).Body

  if (!objectData) {
    throw new Error(`No object body for ${id}`)
  }

  return {
    name: idData.objectName,
    data: await objectData.transformToByteArray(),
  }
}
