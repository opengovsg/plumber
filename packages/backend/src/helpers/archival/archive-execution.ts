import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { Knex } from 'knex'
import { DateTime } from 'luxon'
import { promisify } from 'node:util'
import { gzip } from 'node:zlib'

import { buildS3Key } from './build-s3-key'
import logger from './logger'
import { putArchiveObject } from './s3-client'
import type { ExecutionRow, ExecutionStepRow } from './types'

const gzipAsync = promisify(gzip)

type ArchiveOpts = {
  dryRun: boolean
  bucket: string
  s3Client: S3Client
  knexClient: Knex
  runAt: string
}

export async function archiveExecution(
  execution: ExecutionRow,
  steps: ExecutionStepRow[],
  opts: ArchiveOpts,
): Promise<'archived' | 'skipped'> {
  const payload = JSON.stringify({ execution, steps })
  const compressed = await gzipAsync(payload)

  const bucket = opts.bucket
  const key = buildS3Key(execution)

  await putArchiveObject({
    s3Client: opts.s3Client,
    bucket,
    key,
    body: compressed,
    contentType: 'application/gzip',
    checksumAlgorithm: 'SHA256',
    metadata: {
      'flow-id': execution.flowId,
      'execution-id': execution.id,
      'execution-created-at': execution.createdAt,
      'archived-at': DateTime.now().toISO(),
      'step-count': String(steps.length),
      'archival-run-at': opts.runAt,
    },
  })

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
      if (!execution.testRun) {
        await trx('flows')
          .where('id', execution.flowId)
          .increment('archived_execution_count', 1)
      }
    })
  }

  return 'archived'
}
