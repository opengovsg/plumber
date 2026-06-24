import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3'
import { promisify } from 'node:util'
import { gunzip } from 'node:zlib'

import { S3_PREFIX_EXECUTIONS, S3_PREFIX_TEST_EXECUTIONS } from './build-s3-key'
import type { ArchivedPayload } from './types'

const gunzipAsync = promisify(gunzip)

type FetchOpts = { bucket: string; s3Client: S3Client }

async function scanPrefix(
  prefix: string,
  executionId: string,
  opts: FetchOpts,
): Promise<string | null> {
  let continuationToken: string | undefined
  do {
    const response = await opts.s3Client.send(
      new ListObjectsV2Command({
        Bucket: opts.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    )
    for (const obj of response.Contents ?? []) {
      if (obj.Key?.endsWith(`/execution_id=${executionId}.json.gz`)) {
        return obj.Key
      }
    }
    continuationToken = response.NextContinuationToken
  } while (continuationToken)
  return null
}

async function findS3Key(
  flowId: string,
  executionId: string,
  opts: FetchOpts,
): Promise<string> {
  for (const typePrefix of [S3_PREFIX_EXECUTIONS, S3_PREFIX_TEST_EXECUTIONS]) {
    const key = await scanPrefix(
      `${typePrefix}/flow_id=${flowId}/`,
      executionId,
      opts,
    )
    if (key) {
      return key
    }
  }
  throw new Error(
    `Archived execution not found: flowId=${flowId} executionId=${executionId}`,
  )
}

export async function fetchArchivedExecution(
  flowId: string,
  executionId: string,
  opts: FetchOpts,
): Promise<ArchivedPayload> {
  const key = await findS3Key(flowId, executionId, opts)
  const response = await opts.s3Client.send(
    new GetObjectCommand({ Bucket: opts.bucket, Key: key }),
  )
  if (!response.Body) {
    throw new Error(`S3 object has no body: ${key}`)
  }
  const compressed = await response.Body.transformToByteArray()
  const json = await gunzipAsync(compressed)
  return JSON.parse(json.toString()) as ArchivedPayload
}
