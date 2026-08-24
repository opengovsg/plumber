import type { IActionJobData } from '@plumber/types'
import { type JobPro } from '@taskforcesh/bullmq-pro'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getJobQueueTimingTags } from '../job-queue-timing'

function makeJob(
  overrides: Partial<JobPro<IActionJobData>> &
    Pick<JobPro<IActionJobData>, 'timestamp' | 'data'>,
): JobPro<IActionJobData> {
  return {
    opts: {},
    attemptsStarted: 1,
    ...overrides,
  } as unknown as JobPro<IActionJobData>
}

describe('getJobQueueTimingTags', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('measures from job.timestamp when retryTimestamp is absent', () => {
    vi.spyOn(Date, 'now').mockReturnValue(5000)
    const job = makeJob({
      timestamp: 1000,
      opts: { delay: 500 },
      attemptsStarted: 2,
      data: { flowId: 'f', executionId: 'e', stepId: 's' },
    })

    expect(getJobQueueTimingTags(job)).toEqual({
      jobEnqueueTime: 1000,
      jobDelay: 500,
      attempts: 2,
      timeInJobQueue: 5000 - 1000 - 500,
    })
  })

  it('defaults jobDelay to 0 when opts.delay is absent and retryTimestamp is absent', () => {
    vi.spyOn(Date, 'now').mockReturnValue(5000)
    const job = makeJob({
      timestamp: 1000,
      opts: {},
      data: { flowId: 'f', executionId: 'e', stepId: 's' },
    })

    expect(getJobQueueTimingTags(job)).toEqual({
      jobEnqueueTime: 1000,
      jobDelay: 0,
      attempts: 1,
      timeInJobQueue: 5000 - 1000,
    })
  })

  it('measures from retryTimestamp and ignores opts.delay once a retry has been stamped', () => {
    vi.spyOn(Date, 'now').mockReturnValue(10000)
    const job = makeJob({
      timestamp: 1000, // stale original enqueue time
      opts: { delay: 500 }, // stale original delay - retries requeue to wait, not delayed
      attemptsStarted: 3,
      data: {
        flowId: 'f',
        executionId: 'e',
        stepId: 's',
        retryTimestamp: 8000,
      },
    })

    expect(getJobQueueTimingTags(job)).toEqual({
      jobEnqueueTime: 8000,
      jobDelay: 0,
      attempts: 3,
      timeInJobQueue: 10000 - 8000,
    })
  })
})
