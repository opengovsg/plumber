import { archiveExecution } from './archive-execution'
import { archivalConfig } from './config'
import { archivalDb, archivalDbReader } from './db'
import logger from './logger'
import { archiveS3Client } from './s3-client'
import type { ExecutionRow, ExecutionStepRow } from './types'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function runArchivalLoop(signal: AbortSignal): Promise<void> {
  const {
    archiveDryRun: dryRun,
    archiveRetentionDays: retentionDays,
    archiveBatchSize: batchSize,
    archiveBatchSleepMs: sleepMs,
    archiveBucket,
    archiveDeletedFlowsOnly,
  } = archivalConfig

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)

  let cursor: string | null = null
  let totalArchived = 0
  let totalSkipped = 0
  const archivedByFlow = new Map<string, string[]>()
  const startedAt = Date.now()

  while (!signal.aborted) {
    const batch = (await archivalDbReader('executions')
      .select(
        'id',
        'flow_id as flowId',
        'status',
        'test_run as testRun',
        'internal_id as internalId',
        'created_at as createdAt',
        'updated_at as updatedAt',
        'deleted_at as deletedAt',
      )
      .where((builder) => {
        builder
          // Deleted-flow executions are archived immediately — no cutoff, no status check.
          // The flow is already gone from the UI; retention age is irrelevant.
          .where((b) =>
            b.whereIn(
              'flow_id',
              archivalDbReader('flows').select('id').whereNotNull('deleted_at'),
            ),
          )
          // Non-test executions on active flows: terminal status + past cutoff.
          .orWhere((b) =>
            b
              .where('test_run', false)
              .where('created_at', '<', cutoff)
              .whereIn('status', ['success', 'failure']),
          )
          // Test executions on active flows: past cutoff.
          .orWhere((b) =>
            b
              .where('test_run', true)
              .where('created_at', '<', cutoff),
          )
      })
      // Never archive the designated test execution of any flow (deleted or active).
      // This avoids having to NULL flows.test_execution_id in the archival transaction.
      .whereNotIn(
        'id',
        archivalDbReader('flows')
          .select('test_execution_id')
          .whereNotNull('test_execution_id'),
      )
      .modify((qb) => {
        if (archiveDeletedFlowsOnly) {
          qb.whereIn(
            'flow_id',
            archivalDbReader('flows').select('id').whereNotNull('deleted_at'),
          )
        }
      })
      .modify((qb) => {
        if (cursor) {
          qb.whereRaw('id > ?::uuid', [cursor])
        }
      })
      .orderBy('id')
      .limit(batchSize)) as ExecutionRow[]

    if (!batch.length) {
      break
    }

    let batchArchived = 0
    let batchSkipped = 0
    let lastProcessed: ExecutionRow | null = null

    for (const execution of batch) {
      if (signal.aborted) {
        break
      }

      const steps = (await archivalDbReader('execution_steps')
        .select(
          'id',
          'execution_id as executionId',
          'step_id as stepId',
          'app_key as appKey',
          'key',
          'job_id as jobId',
          'status',
          'data_in as dataIn',
          'data_out as dataOut',
          'error_details as errorDetails',
          'metadata',
          'created_at as createdAt',
          'updated_at as updatedAt',
          'deleted_at as deletedAt',
        )
        .where('execution_id', execution.id)
        .orderBy('created_at')) as ExecutionStepRow[]

      try {
        const result = await archiveExecution(execution, steps, {
          dryRun,
          bucket: archiveBucket,
          s3Client: archiveS3Client,
          knexClient: archivalDb,
        })
        if (result === 'archived') {
          batchArchived++
          const ids = archivedByFlow.get(execution.flowId) ?? []
          ids.push(execution.id)
          archivedByFlow.set(execution.flowId, ids)
        } else {
          batchSkipped++
        }
      } catch (err) {
        logger.error('archival: unexpected error, skipping execution', {
          executionId: execution.id,
          err,
        })
        batchSkipped++
      }
      lastProcessed = execution
    }

    if (lastProcessed) {
      cursor = lastProcessed.id
    }
    totalArchived += batchArchived
    totalSkipped += batchSkipped

    logger.info({
      event: 'archival.batch.complete',
      batchArchived,
      batchSkipped,
      cursor,
      durationMs: Date.now() - startedAt,
    })

    if (!signal.aborted && sleepMs > 0) {
      await sleep(sleepMs)
    }
  }

  for (const [flowId, executionIds] of archivedByFlow) {
    logger.info({
      event: 'archival.flow.archived',
      flowId,
      executionIds,
      count: executionIds.length,
    })
  }

  logger.info({
    event: 'archival.run.complete',
    executions_archived: totalArchived,
    executions_skipped: totalSkipped,
    durationMs: Date.now() - startedAt,
  })
}
