import '@/types/luxon-extensions'
import { DateTime } from 'luxon'
import pLimit from 'p-limit'

import { archiveExecution } from './archive-execution'
import { archivalConfig } from './config'
import { archivalDb, archivalDbReader } from './db'
import {
  assertTidRangeScanSupported,
  formatTid,
  getExecutionsHeapPages,
  parseTid,
  type Tid,
} from './executions-heap'
import logger from './logger'
import { archiveS3Client, putArchiveObject } from './s3-client'
import type { ExecutionRow, ExecutionStepRow } from './types'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Bounds each batch query to a slice of heap pages. The planner sorts every row a TID range
// scan returns, so an unbounded `ctid > cursor ORDER BY ctid` would sort the rest of the table.
const INITIAL_WINDOW_PAGES = 64
const MIN_WINDOW_PAGES = 8
const MAX_WINDOW_PAGES = 4096

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
    archiveMaxRuntimeMs,
  } = archivalConfig

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)

  await assertTidRangeScanSupported()

  // Walk the heap in ctid order to archive the oldest executions first. No index leads with
  // created_at, and Postgres stores rows in insertion order until vacuum frees space for reuse.
  // Offset 0 never holds a row, so `ctid > (page,0)` starts at the top of that page.
  let cursor: Tid = { page: 0, offset: 0 }
  let windowPages = INITIAL_WINDOW_PAGES
  let heapPages = await getExecutionsHeapPages()
  let totalArchived = 0
  let totalTestArchived = 0
  let totalSkipped = 0
  // IMPORTANT: store counts, not IDs. A flow can own 100k+ executions, and logging every ID
  // produced multi-MB lines that stdout could not flush before the process exited.
  const archivedByFlow = new Map<
    string,
    { executionsCount: number; testExecutionsCount: number }
  >()
  // SGT date (yyyy-MM-dd) -> appKey -> key -> count
  const stepCounts = new Map<string, Map<string, Map<string, number>>>()
  let nullStepCount = 0
  const startedAt = Date.now()
  const runAt = new Date(startedAt).toISOString()

  while (!signal.aborted) {
    if (
      archiveMaxRuntimeMs > 0 &&
      Date.now() - startedAt >= archiveMaxRuntimeMs
    ) {
      logger.info({
        event: 'archival.run.max_runtime_reached',
        maxRuntimeMs: archiveMaxRuntimeMs,
        durationMs: Date.now() - startedAt,
      })
      break
    }

    if (cursor.page >= heapPages) {
      // Re-read the size because inserts extend the heap during the run.
      heapPages = await getExecutionsHeapPages()
      if (cursor.page >= heapPages) {
        break
      }
    }

    // When archiveDeletedFlowsOnly is set we skip the full three-branch OR
    // entirely — just a single whereIn on deleted flows. This avoids asking
    // Postgres to plan a complex multi-branch query when the full query will
    // be filtered down to the same deleted-flows set anyway.
    //
    // Note: this subquery is evaluated live per batch, not snapshotted at run
    // start. A flow soft-deleted mid-run will have its executions ahead of the
    // cursor picked up by later batches, with no cutoff check. Retries are therefore
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
    const windowEnd: Tid = { page: cursor.page + windowPages, offset: 0 }
    const rows = (await eligibilityQuery
      .select(archivalDbReader.raw('executions.ctid::text as ctid'))
      // Never archive the designated test execution of any flow (deleted or active).
      // LEFT JOIN anti-join: cheaper than NOT IN (subquery) when the flows table grows.
      .leftJoin('flows as f_tex', 'executions.id', 'f_tex.test_execution_id')
      .whereNull('f_tex.test_execution_id')
      .whereRaw('executions.ctid > ?::tid AND executions.ctid < ?::tid', [
        formatTid(cursor),
        formatTid(windowEnd),
      ])
      // Exclude flows with archiveDisabled set in flow config. Applies to all
      // flows (active and deleted) so rehydrated executions are protected until
      // the operator clears the flag.
      .whereNotIn(
        'flow_id',
        archivalDbReader('flows')
          .select('id')
          .whereRaw(`config->>'archiveDisabled' = 'true'`),
      )
      .orderBy('executions.ctid')
      .limit(batchSize)) as Array<ExecutionRow & { ctid: string }>

    // Cursor advances regardless of outcome. Failed executions stay eligible and are
    // retried on the next scheduled run.
    // Shrink the window after a full batch and grow it after a short one, so each query
    // reads about one batch of eligible rows.
    if (rows.length === batchSize) {
      cursor = parseTid(rows[rows.length - 1].ctid)
      windowPages = Math.max(MIN_WINDOW_PAGES, Math.floor(windowPages / 2))
    } else {
      cursor = windowEnd
      windowPages = Math.min(MAX_WINDOW_PAGES, windowPages * 2)
    }

    if (!rows.length) {
      continue
    }

    // ctid only drives the cursor. It must not reach the archived payload.
    const batch: ExecutionRow[] = rows.map(
      ({ ctid: _ctid, ...execution }) => execution,
    )

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
          executionsCount: 0,
          testExecutionsCount: 0,
        }
        if (execution.testRun) {
          entry.testExecutionsCount++
          totalTestArchived++
        } else {
          entry.executionsCount++
        }
        archivedByFlow.set(execution.flowId, entry)

        if (!execution.testRun) {
          for (const step of steps) {
            if (step.appKey && step.key) {
              // Partition by SGT so usage rollups match user-reported run times.
              const date = DateTime.fromJSDate(
                new Date(step.createdAt),
              ).toPlumberFormat('yyyy-MM-dd')

              const appMap =
                stepCounts.get(date) ?? new Map<string, Map<string, number>>()
              const keyMap =
                appMap.get(step.appKey) ?? new Map<string, number>()
              keyMap.set(step.key, (keyMap.get(step.key) ?? 0) + 1)
              appMap.set(step.appKey, keyMap)
              stepCounts.set(date, appMap)
            } else {
              nullStepCount++
            }
          }
        }
      } else {
        batchSkipped++
      }
    }

    totalArchived += batchArchived
    totalSkipped += batchSkipped

    logger.info({
      event: 'archival.batch.complete',
      batchArchived,
      batchSkipped,
      cursor: formatTid(cursor),
      durationMs: Date.now() - startedAt,
    })

    if (!signal.aborted && sleepMs > 0) {
      await sleep(sleepMs)
    }
  }

  for (const [flowId, counts] of archivedByFlow) {
    logger.info({ event: 'archival.flow.archived', flowId, ...counts })
  }

  const stepCountsObj: Record<
    string,
    Record<string, Record<string, number>>
  > = {}
  for (const [date, appMap] of stepCounts) {
    const appObj: Record<string, Record<string, number>> = {}
    for (const [appKey, keyMap] of appMap) {
      appObj[appKey] = Object.fromEntries(keyMap)
    }
    stepCountsObj[date] = appObj
  }

  const durationMs = Date.now() - startedAt
  const counts = {
    executions_archived: totalArchived,
    real_executions_archived: totalArchived - totalTestArchived,
    test_executions_archived: totalTestArchived,
    executions_skipped: totalSkipped,
    durationMs,
  }

  // Write the summary before logging completion, so run.complete only appears
  // once nothing else can fail.
  try {
    await putArchiveObject({
      s3Client: archiveS3Client,
      bucket: archiveBucket,
      key: `_meta/runs/${runAt}.json`,
      body: JSON.stringify({
        runAt,
        dryRun,
        executionsArchived: totalArchived,
        realExecutionsArchived: totalArchived - totalTestArchived,
        testExecutionsArchived: totalTestArchived,
        executionsSkipped: totalSkipped,
        flowsAffected: archivedByFlow.size,
        stepCounts: stepCountsObj,
        nullStepCount,
        durationMs,
      }),
      contentType: 'application/json',
    })
  } catch (err) {
    // The executions are already archived, so this log is the only remaining record of the run's counts.
    logger.error({ event: 'archival.run.meta_write_failed', ...counts, err })
    throw err
  }

  logger.info({ event: 'archival.run.complete', ...counts })
}
