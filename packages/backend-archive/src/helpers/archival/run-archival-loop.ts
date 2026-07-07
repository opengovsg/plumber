import pLimit from 'p-limit'

import { archiveExecution } from './archive-execution'
import { archivalConfig } from './config'
import { archivalDb, archivalDbReader } from './db'
import logger from './logger'
import { archiveS3Client, putArchiveObject } from './s3-client'
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
    archiveTestRuns,
    archiveIntraBatchConcurrency,
  } = archivalConfig

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)

  let cursor: string | null = null
  let totalArchived = 0
  let totalSkipped = 0
  const archivedByFlow = new Map<
    string,
    { executionIds: string[]; testExecutionIds: string[] }
  >()
  const stepCounts = new Map<string, Map<string, number>>()
  let nullStepCount = 0
  const startedAt = Date.now()
  const runAt = new Date(startedAt).toISOString()

  while (!signal.aborted) {
    // When archiveDeletedFlowsOnly is set we skip the full three-branch OR
    // entirely — just a single whereIn on deleted flows. This avoids asking
    // Postgres to plan a complex multi-branch query when the full query will
    // be filtered down to the same deleted-flows set anyway.
    //
    // Note: this subquery is evaluated live per batch, not snapshotted at run
    // start. A flow soft-deleted mid-run will have its executions picked up on
    // the next batch (immediately, with no cutoff check). Retries are therefore
    // not fully idempotent with respect to the deleted-flows set — but this is
    // harmless since already-archived rows are removed from source, making
    // double-archiving impossible.
    const deletedFlowsSubquery = archivalDbReader('flows')
      .select('id')
      .whereNotNull('deleted_at')

    let eligibilityQuery
    if (archiveDeletedFlowsOnly) {
      const base = archivalDbReader('executions').select(
        'executions.id as id',
        'executions.flow_id as flowId',
        'executions.status as status',
        'executions.test_run as testRun',
        'executions.internal_id as internalId',
        'executions.created_at as createdAt',
        'executions.updated_at as updatedAt',
        'executions.deleted_at as deletedAt',
      )
      if (archiveTestRuns) {
        eligibilityQuery = base.where((builder) => {
          builder
            .where((b) => b.whereIn('flow_id', deletedFlowsSubquery))
            .orWhere((b) =>
              b
                .where('test_run', true)
                .where('executions.created_at', '<', cutoff),
            )
        })
      } else {
        eligibilityQuery = base.whereIn('flow_id', deletedFlowsSubquery)
      }
    } else {
      eligibilityQuery = archivalDbReader('executions')
        .select(
          'executions.id as id',
          'executions.flow_id as flowId',
          'executions.status as status',
          'executions.test_run as testRun',
          'executions.internal_id as internalId',
          'executions.created_at as createdAt',
          'executions.updated_at as updatedAt',
          'executions.deleted_at as deletedAt',
        )
        .where((builder) => {
          builder
            // Deleted-flow executions: archived immediately — no cutoff, no status check.
            // The flow is already gone from the UI; retention age is irrelevant.
            .where((b) => b.whereIn('flow_id', deletedFlowsSubquery))
            // Non-test executions on active flows: terminal status + past cutoff.
            .orWhere((b) =>
              b
                .where('test_run', false)
                .where('executions.created_at', '<', cutoff)
                .whereIn('status', ['success', 'failure']),
            )
            // Test executions on active flows: past cutoff only.
            .orWhere((b) =>
              b
                .where('test_run', true)
                .where('executions.created_at', '<', cutoff),
            )
        })
    }

    // TODO(perf): the batch query still hits `flows` twice via subqueries
    // (deleted_at, archiveDisabled). If batch times climb, add a partial index
    // on `(id) WHERE config->>'archiveDisabled' = 'true'` for the JSONB filter.
    const batch = (await eligibilityQuery
      // Never archive the designated test execution of any flow (deleted or active).
      // LEFT JOIN anti-join: cheaper than NOT IN (subquery) when the flows table grows.
      .leftJoin('flows as f_tex', 'executions.id', 'f_tex.test_execution_id')
      .whereNull('f_tex.test_execution_id')
      .modify((qb) => {
        if (cursor) {
          qb.whereRaw('executions.id > ?::uuid', [cursor])
        }
      })
      // Exclude flows with archiveDisabled set in flow config. Applies to all
      // flows (active and deleted) so rehydrated executions are protected until
      // the operator clears the flag.
      .whereNotIn(
        'flow_id',
        archivalDbReader('flows')
          .select('id')
          .whereRaw(`config->>'archiveDisabled' = 'true'`),
      )
      .orderBy('executions.id')
      .limit(batchSize)) as ExecutionRow[]

    if (!batch.length) {
      break
    }

    let batchArchived = 0
    let batchSkipped = 0

    const limit = pLimit(archiveIntraBatchConcurrency)

    const results = await Promise.allSettled(
      batch.map((execution) =>
        limit(async () => {
          if (signal.aborted) {
            return {
              execution,
              outcome: 'skipped' as const,
              steps: [] as ExecutionStepRow[],
            }
          }

          // LEFT JOIN steps to fill in app_key/key for old rows that predate
          // the denormalised columns being added to execution_steps.
          // TODO: once all pre-denormalisation rows have been archived, drop the
          // LEFT JOIN and COALESCE and select app_key/key directly from execution_steps.
          const steps = (await archivalDbReader('execution_steps')
            .select(
              'execution_steps.id',
              'execution_steps.execution_id as executionId',
              'execution_steps.step_id as stepId',
              archivalDbReader.raw(
                'COALESCE(execution_steps.app_key, steps.app_key) as "appKey"',
              ),
              archivalDbReader.raw(
                'COALESCE(execution_steps.key, steps.key) as "key"',
              ),
              'execution_steps.job_id as jobId',
              'execution_steps.status',
              'execution_steps.data_in as dataIn',
              'execution_steps.data_out as dataOut',
              'execution_steps.error_details as errorDetails',
              'execution_steps.metadata',
              'execution_steps.created_at as createdAt',
              'execution_steps.updated_at as updatedAt',
              'execution_steps.deleted_at as deletedAt',
            )
            .leftJoin('steps', 'execution_steps.step_id', 'steps.id')
            .where('execution_steps.execution_id', execution.id)
            .orderBy('execution_steps.created_at')) as ExecutionStepRow[]

          try {
            const outcome = await archiveExecution(execution, steps, {
              dryRun,
              bucket: archiveBucket,
              s3Client: archiveS3Client,
              knexClient: archivalDb,
              runAt,
            })
            return { execution, outcome, steps }
          } catch (err) {
            logger.error({
              event: 'archival.execution.error',
              executionId: execution.id,
              err,
            })
            return {
              execution,
              outcome: 'skipped' as const,
              steps: [] as ExecutionStepRow[],
            }
          }
        }),
      ),
    )

    for (const settled of results) {
      if (settled.status === 'rejected') {
        batchSkipped++
        continue
      }

      const { execution, outcome, steps } = settled.value
      if (outcome === 'archived') {
        batchArchived++
        const entry = archivedByFlow.get(execution.flowId) ?? {
          executionIds: [],
          testExecutionIds: [],
        }
        if (execution.testRun) {
          entry.testExecutionIds.push(execution.id)
        } else {
          entry.executionIds.push(execution.id)
        }
        archivedByFlow.set(execution.flowId, entry)

        for (const step of steps) {
          if (step.appKey && step.key) {
            const keyMap =
              stepCounts.get(step.appKey) ?? new Map<string, number>()
            keyMap.set(step.key, (keyMap.get(step.key) ?? 0) + 1)
            stepCounts.set(step.appKey, keyMap)
          } else {
            nullStepCount++
          }
        }
      } else {
        batchSkipped++
      }
    }

    // Cursor advances to the last execution in the batch regardless of outcome.
    // Failed executions stay eligible and are retried on the next scheduled run.
    cursor = batch[batch.length - 1].id
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

  for (const [flowId, { executionIds, testExecutionIds }] of archivedByFlow) {
    logger.info({
      event: 'archival.flow.archived',
      flowId,
      executionIds,
      testExecutionIds,
      executionsCount: executionIds.length,
      testExecutionsCount: testExecutionIds.length,
    })
  }

  logger.info({
    event: 'archival.run.complete',
    executions_archived: totalArchived,
    executions_skipped: totalSkipped,
    durationMs: Date.now() - startedAt,
  })

  const stepCountsObj: Record<string, Record<string, number>> = {}
  for (const [appKey, keyMap] of stepCounts) {
    stepCountsObj[appKey] = Object.fromEntries(keyMap)
  }

  await putArchiveObject({
    s3Client: archiveS3Client,
    bucket: archiveBucket,
    key: `_meta/runs/${runAt}.json`,
    body: JSON.stringify({
      runAt,
      dryRun,
      executionsArchived: totalArchived,
      executionsSkipped: totalSkipped,
      flowsAffected: archivedByFlow.size,
      stepCounts: stepCountsObj,
      nullStepCount,
      durationMs: Date.now() - startedAt,
    }),
    contentType: 'application/json',
  })
}
