import type { IActionJobData } from '@plumber/types'

import type { JobPro } from '@taskforcesh/bullmq-pro'

export function getJobQueueTimingTags(job: JobPro<IActionJobData>) {
  const { retryQueuedAt } = job.data
  const jobEnqueueTime = retryQueuedAt ?? job.timestamp
  // Once a job has been retried (manually or automatically), the original
  // static opts.delay no longer applies - retries re-queue directly to wait,
  // bypassing delay entirely.
  const jobDelay = retryQueuedAt ? 0 : job.opts?.delay ?? 0

  return {
    jobEnqueueTime,
    jobDelay,
    attempts: job.attemptsStarted,
    timeInJobQueue: Date.now() - jobEnqueueTime - jobDelay,
  }
}
