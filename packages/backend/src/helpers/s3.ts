import { IGlobalVariable } from '@plumber/types'

import type {
  GetObjectCommandInput,
  GetObjectCommandOutput,
  ObjectIdentifier,
  PutObjectCommandInput,
} from '@aws-sdk/client-s3'
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  GetObjectTaggingCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import appConfig from '@/config/app'
import StepError from '@/errors/step'

export const COMMON_S3_BUCKET = appConfig.s3CommonBucket
export const COMMON_S3_MOCK_FOLDER_PREFIX = `s3:${COMMON_S3_BUCKET}:mock/`

export const MALWARE_SCAN_STATUS = {
  THREATS_FOUND: 'THREATS_FOUND',
  NO_THREATS_FOUND: 'NO_THREATS_FOUND',
  UNSUPPORTED: 'UNSUPPORTED',
  ACCESS_DENIED: 'ACCESS_DENIED',
  FAILED: 'FAILED',

  // note: own status to indicate scan in progress when no tag is found
  PENDING: 'PENDING',
}

export const MALWARE_SCAN_SUCCESS = MALWARE_SCAN_STATUS.NO_THREATS_FOUND
export const MALWARE_SCAN_FAILURE = [
  MALWARE_SCAN_STATUS.THREATS_FOUND,
  MALWARE_SCAN_STATUS.UNSUPPORTED,
  MALWARE_SCAN_STATUS.ACCESS_DENIED,
  MALWARE_SCAN_STATUS.FAILED,
]

function throwAttachmentError(
  errorType: string,
  metadata: Record<string, string>,
  $: IGlobalVariable,
) {
  let name
  let solution
  switch (errorType) {
    case MALWARE_SCAN_STATUS.THREATS_FOUND:
      name = `Attachment malware scan found threats in: ${metadata.filename}`
      solution = 'Please delete the attachment and try again.'
      break
    case MALWARE_SCAN_STATUS.UNSUPPORTED:
      name = `Unsupported attachment: ${metadata.filename}`
      solution = 'Please delete the attachment and try again.'
      break
    case MALWARE_SCAN_STATUS.PENDING:
      name = `Attachment malware scan in progress`
      solution = 'Please try again in a few minutes.'
      break
    default:
      name = `Attachment malware scan failed`
      solution = 'Please try again in a few minutes.'
      break
  }

  throw new StepError(name, solution, $.step.position, $.app.name)
}

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

  // check for possible path traversal
  objectKey.split('/').forEach((segment) => {
    if (segment === '..') {
      throw new Error(`Invalid S3 ID: path traversal detected in ${objectKey}`)
    }
  })

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
 * Generates a pre-signed URL for uploading objects to S3.
 * The URL expires after 5 minutes.
 *
 * @param bucket - The S3 bucket name
 * @param objectKey - The key (path) where the object will be stored in S3
 * @param metadata - Optional metadata to be attached to the object
 *
 * @returns A pre-signed URL that can be used to upload the object using a PUT request
 *
 * *Note 2:* This doesn't validate `objectKey`; the caller is expected to make
 * sure it's formatted correctly.
 */
export async function getPresignedUrl(
  bucket: string,
  objectKey: string,
  contentType: string,
  metadata: PutObjectCommandInput['Metadata'] | null,
): Promise<string> {
  const putObjectCommand = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: contentType,
    Metadata: metadata,
  })

  const presignedUrl = await getSignedUrl(s3Client, putObjectCommand, {
    expiresIn: 5 * 60, // 5 minutes
  })

  return presignedUrl
}

/**
 * Deletes multiple objects from our S3 store and returns true if deleted successfully.
 * *Note 1:* This doesn't validate `objectKey`; the caller is expected to make
 * sure it's formatted correctly.
 *
 * *Note 2:* This will return true even if the objectKey does not exist.
 */
export async function deleteObjects(
  bucket: string,
  objectKeys: ObjectIdentifier[],
) {
  try {
    const res = await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: objectKeys },
      }),
    )

    if (res.$metadata.httpStatusCode === 200) {
      return true
    } else {
      throw new Error('Error deleting object')
    }
  } catch (err) {
    throw new Error(`Error deleting object: ${err.message}`)
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
export async function getObjectFromS3Id(
  id: string,
  metadataToCheck?: Record<string, string>,
  $?: IGlobalVariable,
): Promise<S3Object> {
  const idData = parseS3Id(id)
  if (!idData) {
    throw new Error(`Invalid S3 ID: ${id}`)
  }

  const { Body: objectData, Metadata: metadata } = await s3Client.send<
    GetObjectCommandInput,
    GetObjectCommandOutput
  >(new GetObjectCommand({ Bucket: idData.bucket, Key: idData.objectKey }))

  if (!objectData) {
    throw new Error(`No object body for ${id}`)
  }

  /**
   * We ignore metadataToCheck for common S3 mock folder
   */
  if (!id.startsWith(COMMON_S3_MOCK_FOLDER_PREFIX) && metadataToCheck) {
    for (const [key, expectedValue] of Object.entries(metadataToCheck)) {
      // s3 converts metadata keys to lowercase
      const storedValue = metadata?.[key.toLocaleLowerCase()]
      if (storedValue !== expectedValue) {
        throw new Error(
          `S3 metadata mismatch for ${idData.objectKey}: expected ${key}=${expectedValue}, got ${storedValue}`,
        )
      }

      if (metadata?.manualupload && JSON.parse(metadata?.manualupload)) {
        const { isValid, scanStatus } = await checkObjectScanStatus(
          idData.bucket,
          idData.objectKey,
        )
        if (!isValid) {
          throwAttachmentError(scanStatus, metadata, $)
        }
      }
    }
  }

  return {
    name: idData.objectName,
    data: await objectData.transformToByteArray(),
  }
}

export async function checkObjectScanStatus(bucket: string, objectKey: string) {
  const { TagSet } = await s3Client.send(
    new GetObjectTaggingCommand({ Bucket: bucket, Key: objectKey }),
  )

  if (!TagSet || !TagSet.length) {
    return { isValid: false, scanStatus: MALWARE_SCAN_STATUS.PENDING }
  }
  const scanStatus = TagSet.find(
    (obj) => obj.Key === 'GuardDutyMalwareScanStatus',
  )?.Value

  if (scanStatus === MALWARE_SCAN_SUCCESS) {
    return { isValid: true }
  }

  return { isValid: false, scanStatus: scanStatus }
}
