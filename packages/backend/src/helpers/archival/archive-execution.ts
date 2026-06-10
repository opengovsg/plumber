import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import type { Knex } from 'knex'
import { promisify } from 'node:util'
import { gzip } from 'node:zlib'

import { buildS3Key } from './build-s3-key'
import logger from './logger'
import type { ExecutionRow, ExecutionStepRow } from './types'

const gzipAsync = promisify(gzip)

type ArchiveOpts = {
  dryRun: boolean
  execsBucket: string
  testExecsBucket: string
  s3Client: S3Client
  knexClient: Knex
}

export async function archiveExecution(
  execution: ExecutionRow,
  steps: ExecutionStepRow[],
  opts: ArchiveOpts,
): Promise<'archived' | 'skipped'> {
  const payload = JSON.stringify({ execution, steps })
  const compressed = await gzipAsync(payload)

  const bucket = execution.testRun ? opts.testExecsBucket : opts.execsBucket
  const key = buildS3Key(execution)

  await opts.s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: compressed,
      ContentType: 'application/gzip',
      ContentEncoding: 'gzip',
      Metadata: {
        'flow-id': execution.flowId,
        'execution-id': execution.id,
        'execution-created-at': new Date(execution.createdAt).toISOString(),
        'archived-at': new Date().toISOString(),
        'step-count': String(steps.length),
      },
    }),
  )

  let head: { ContentLength?: number }
  try {
    head = await opts.s3Client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    )
  } catch (err) {
    logger.error('archival: S3 verify threw, skipping', {
      executionId: execution.id,
      key,
      err,
    })
    return 'skipped'
  }

  if (!head.ContentLength) {
    logger.error('archival: S3 verify failed (zero ContentLength), skipping', {
      executionId: execution.id,
      key,
    })
    return 'skipped'
  }

  if (!opts.dryRun) {
    await opts.knexClient.transaction(async (trx) => {
      await trx('execution_steps').where('execution_id', execution.id).delete()
      await trx('executions').where('id', execution.id).delete()
    })
  }

  return 'archived'
}
