import type { IActionJobData } from '@plumber/types'

import { UnrecoverableError, WorkerPro } from '@taskforcesh/bullmq-pro'

import tracer from '@/helpers/tracer'

import {
  convertParamsToBullMqOptions,
  type MakeActionWorkerParams,
  processSingleActionJob,
} from './make-action-worker'
import { registerWorkerEventHandlers } from './worker-event-handlers'

/**
 * Creates a batch worker for an app's dedicated batch action queue (BullMQ Pro
 * batches). Jobs are coalesced by group affinity so every batch belongs to a
 * single group.
 *
 * For now this is a stub: a batch of 1 job is processed exactly like a regular
 * single job (reusing {@link processSingleActionJob}); a batch of >1 tags the
 * span with `batchSize` and throws - real multi-job dispatch is PR B.
 */
export function makeBatchActionWorker(
  params: MakeActionWorkerParams,
): WorkerPro<IActionJobData> {
  const batchConfig = params.queueConfig.batch
  if (!batchConfig) {
    throw new Error(
      `makeBatchActionWorker called for "${params.queueName}" without a batch config`,
    )
  }

  const { queueName, workerOptions, isQueueDelayable } =
    convertParamsToBullMqOptions(params)

  // BullMQ Pro batch options. groupAffinity guarantees each batch belongs to a
  // single (fileId, tableId, actionKey) group => exactly one Graph POST.
  workerOptions.batch = {
    size: batchConfig.size,
    groupAffinity: batchConfig.groupAffinity,
    ...(batchConfig.minSize !== undefined
      ? { minSize: batchConfig.minSize }
      : {}),
    ...(batchConfig.timeout !== undefined
      ? { timeout: batchConfig.timeout }
      : {}),
  }

  // Scale the rate limit to the batch size. The per-job limiter (e.g.
  // { max: 1, duration: interval }) would let only one job per batch through;
  // multiplying both terms preserves the same per-file throughput while
  // permitting a full batch to be dispatched at once.
  if (workerOptions.limiter) {
    workerOptions.limiter = {
      max: workerOptions.limiter.max * batchConfig.size,
      duration: workerOptions.limiter.duration * batchConfig.size,
    }
  }

  const worker: WorkerPro<IActionJobData> = new WorkerPro<IActionJobData>(
    queueName,
    tracer.wrap(
      // Fix trace service name to workers.action regardless of queue name, so
      // that we can more easily monitor all actions.
      'workers.action',
      async (job) => {
        const batch = job.getBatch()
        const batchSize = batch.length

        tracer.scope().active()?.addTags({ queueName, batchSize })

        if (batchSize > 1) {
          // Real multi-job dispatch is PR B. Tag batchSize first (above) so the
          // distribution is visible on failing spans during staging.
          throw new UnrecoverableError(
            `Batch dispatch not yet implemented (${batchSize} jobs)`,
          )
        }

        // N <= 1: behaves exactly like a regular single-job worker.
        return processSingleActionJob(job, {
          queueName,
          worker,
          isQueueDelayable,
        })
      },
    ),
    workerOptions,
  )

  registerWorkerEventHandlers(worker, queueName)

  return worker
}
