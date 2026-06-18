import type { IActionBatchQueue } from '@plumber/types'

import { M365_EXCEL_INTERVAL_BETWEEN_ACTIONS_MS } from '@/config/app-env-vars/m365'
import { M365_BATCH_SIZE } from '@/config/workers'
import Step from '@/models/step'

//
// Batch queue config for the m365-excel `createTableRow` action.
//
// Jobs are grouped by `${fileId}::${tableId}::${connectionId}` so that BullMQ
// Pro group affinity guarantees every job in a batch shares one connection AND
// targets the same file + table. That lets `runBatch` (a) collapse the whole
// batch into exactly one multi-row Graph insert, and (b) authorize the batch
// with a SINGLE file-access check instead of one per job - every job shares the
// connection (token + Plumber folder) and the pipe owner, so `validateCanAccessFile`'s
// verdict is identical for all of them.
//
// connectionId is in the key precisely to make (b) safe. The whole batch is
// written through one WorkbookSession after one access check; without pinning
// the connection a batch could in principle mix identities, and the single
// check under the first job's connection would authorize rows written for
// another (privilege escalation). Pinning it at the grouping layer rules that
// out, so runBatch can trust one check (it also asserts the invariant defensively).
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
  const connectionId = step.connectionId

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
  // table ID is appended so each table forms its own batch group (one multi-row
  // POST per batch), and the connection ID is appended last so a batch never
  // mixes connections (so runBatch can authorize it with one access check). A
  // missing connectionId is safe rather than pooled across identities: such jobs
  // share the same empty segment, and runBatch's single access check fails them
  // together (a connection-less m365 job can never pass it anyway).
  return {
    id: `${fileId}::${tableId}::${connectionId ?? ''}`,
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
