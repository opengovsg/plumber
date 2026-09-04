import type { IActionBatchQueue } from '@plumber/types'

import { M365_EXCEL_INTERVAL_BETWEEN_ACTIONS_MS } from '@/config/app-env-vars/m365'
import { M365_BATCH_SIZE } from '@/config/workers'
import Step from '@/models/step'

//
// Batch queue config for the m365-excel `createTableRow` action.
//
// Jobs are grouped by `${fileId}::${tableId}` so that BullMQ Pro group affinity
// guarantees every job in a batch targets the same file + table. That lets
// `runBatch` collapse the whole batch into exactly one multi-row Graph insert.
//
// Note: unlike the per-app queue (queue/index.ts), serialization of same-file
// writes is NOT provided by this queue's grouping/concurrency - it is enforced
// by the explicit per-file Redis lock (see the per-file lock phase). The
// retained rate limit below only throttles how fast we dispatch batches so we
// don't hammer Graph between batches.
//

const getGroupConfigForJob: IActionBatchQueue['getGroupConfigForJob'] = async (
  jobData,
) => {
  const step = await Step.query().findById(jobData.stepId).throwIfNotFound()
  const fileId = step.parameters['fileId'] as string
  const tableId = step.parameters['tableId'] as string

  if (!fileId) {
    throw new Error(
      `Expected fileId to be non-empty for step ${jobData.stepId}`,
    )
  }

  if (!tableId) {
    throw new Error(
      `Expected tableId to be non-empty for step ${jobData.stepId}`,
    )
  }

  // See queue/index.ts for why file ID alone is sufficient tenant-wide; the
  // table ID is appended so each table forms its own batch group (one
  // multi-row POST per batch).
  return {
    id: `${fileId}::${tableId}`,
  }
}

const batchQueueSettings = {
  getGroupConfigForJob,
  queueRateLimit: {
    // One full batch's worth of jobs per window. Must be >= batch.size: the
    // limiter counts individual jobs, so max: 1 would admit one job per window
    // and every batch would collapse to size 1.
    max: M365_BATCH_SIZE,
    duration: M365_EXCEL_INTERVAL_BETWEEN_ACTIONS_MS,
  },
} satisfies IActionBatchQueue

export default batchQueueSettings
