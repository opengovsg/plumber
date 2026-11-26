import { promisify } from 'node:util'
import { gunzip } from 'node:zlib'

import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3'

import { S3_PREFIX_EXECUTIONS, S3_PREFIX_TEST_EXECUTIONS } from './build-s3-key'
import logger from './logger'
import { type ArchivedPayload, ArchivedPayloadSchema } from './types'

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
    logger.error({
      event: 'rehydration.fetch.no_body',
      key,
    })
    throw new Error(`S3 object has no body: ${key}`)
  }
  const compressed = await response.Body.transformToByteArray()
  const json = await gunzipAsync(compressed)
  return parseArchivedPayload(json.toString(), key)
}

/**
 * Parses an archived payload, with errors that name the key and the failing fields only.
 *
 * IMPORTANT: `JSON.parse` and Zod quote the input in their messages, and archives hold user data.
 */
function parseArchivedPayload(json: string, key: string): ArchivedPayload {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new Error(`Archived payload is not valid JSON: ${key}`)
  }
  const parsed = ArchivedPayloadSchema.safeParse(raw)
  if (!parsed.success) {
    const paths = [
      ...new Set(
        parsed.error.issues.map((issue) => issue.path.join('.') || '(root)'),
      ),
    ]
    throw new Error(
      `Archived payload does not match the schema at ${paths.slice(0, 5).join(', ')}: ${key}`,
    )
  }
  return parsed.data
}
