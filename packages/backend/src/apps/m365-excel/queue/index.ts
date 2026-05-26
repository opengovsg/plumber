import type { IAppQueue } from '@plumber/types'

import {
  M365_EXCEL_BATCH_ENABLED,
  M365_EXCEL_INTERVAL_BETWEEN_ACTIONS_MS,
} from '@/config/app-env-vars/m365'
import Step from '@/models/step'

// Sized against two ceilings: (1) Microsoft Graph's 4MB request payload
// limit on `POST /tables/:tableId/rows` — 20 typical rows fit with headroom;
// (2) empirical sweet-spot for batch fill latency under our current traffic
// shape. Going larger risks 413 responses we don't yet split on; going
// smaller wastes coalescing opportunities. Bump together with `groupLimits.
// concurrency` (see the load-bearing invariant below) and re-check Graph
// payload size if rows grow.
const BATCH_SIZE = 20

//
// This config sets up a per-app queue to serialize Excel actions by file, as
// per guidelines from Microsoft.
// https://learn.microsoft.com/en-us/graph/workbook-best-practice?tabs=http#throttling-and-concurrency
//
// It also configures the queue to dispense actions using a leaky bucket
// approach, at a rate that will satisfy the rate limits imposed on us.
//

const getGroupConfigForJob: IAppQueue['getGroupConfigForJob'] = async (
  jobData,
) => {
  const step = await Step.query().findById(jobData.stepId).throwIfNotFound()
  const fileId = step.parameters['fileId'] as string

  if (!fileId) {
    throw new Error(
      `Expected fileId to be non-empty for step ${jobData.stepId}`,
    )
  }

  // NOTE: File ID is only unique within the same SharePoint site and tenant.
  // But since we only have one site per tenant, and we need a different per-app
  // queue for each tenant (each tenant may have different agreed-upon rate
  // limits), we can avoid compleixty and simply set group ID to the file ID,
  // instead of something like `${tenantId}-${siteId}-${fileId}`.
  //
  // (The one app-queue per tenant thing isn't implemnented yet - for now, each
  // app can only have 1 per-app queue. We'll only do this if we ever need to
  // support more than 1 tenant.)
  return {
    id: fileId,
  }
}

const queueSettings = {
  getGroupConfigForJob,
  groupLimits: {
    type: 'concurrency',
    // LOAD-BEARING INVARIANT: when batching is on, this MUST equal
    // `batch.size`. BullMQ Pro increments the per-group active counter per
    // job (see increaseGroupConcurrency.lua), so one batch of size N fills
    // the budget and locks the group for the duration of the batch — which
    // is what preserves Microsoft's per-file serialization. If this is
    // raised ABOVE batch.size, two batches per file could run concurrently
    // and break serialization; if lowered BELOW, batches under-fill and
    // throughput drops. Move both values together when tuning.
    concurrency: M365_EXCEL_BATCH_ENABLED ? BATCH_SIZE : 1,
  },
  isQueueDelayable: true,
  // BullMQ Pro's rate limit is per-JOB at the lua-script level (see
  // prepareJobForProcessing.lua — the counter increments once per job inside
  // the batch fetch loop, not once per batch). So when batching is on, `max`
  // must scale with `batch.size`, otherwise the limiter caps each fetch at 1
  // job and batches silently never grow past size 1. Scaling `duration` by
  // the same factor preserves the long-term throughput target
  // (jobs-per-second = max/duration) while letting one full batch be
  // dispensed per rate window.
  queueRateLimit: M365_EXCEL_BATCH_ENABLED
    ? {
        max: BATCH_SIZE,
        duration: BATCH_SIZE * M365_EXCEL_INTERVAL_BETWEEN_ACTIONS_MS,
      }
    : {
        max: 1,
        duration: M365_EXCEL_INTERVAL_BETWEEN_ACTIONS_MS,
      },
  workerType: 'action',
  ...(M365_EXCEL_BATCH_ENABLED
    ? {
        batch: {
          size: BATCH_SIZE,
          groupAffinity: true as const,
        },
      }
    : {}),
} satisfies IAppQueue

export default queueSettings
