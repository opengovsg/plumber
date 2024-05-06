import { type JobsProOptions } from '@taskforcesh/bullmq-pro'

import appConfig from '@/config/app'

export const REMOVE_AFTER_30_DAYS = {
  age: 30 * 24 * 3600,
}

export const REMOVE_AFTER_7_DAYS_OR_50_JOBS = {
  age: 7 * 24 * 3600,
  count: 50,
}

export const DEFAULT_JOB_DELAY_DURATION = 0

// FIXME (ogp-weeloong): high number to handle expected increased retries from
// M465. Revert back to 6 once BullMQ Pro is in.
//
// Number chosen as follows:
// - Excel step limit is 1 per 3 seconds per file, with exponential backoff of
//   6 seconds.
// - Excel pipes tend to spike at ~100 submissions (i.e. ~100 steps) in a short
//   instance, but never occur again for that day.
// - Due to exponential backoff, between each retry, we can expect 2^attempts
//   steps to make progress. So in the worst case, a step might be retried
//   log2(100) times ~= 7.
// - We round that up to 10 just in case.
export const MAXIMUM_JOB_ATTEMPTS = appConfig.maxJobAttempts

export const DEFAULT_JOB_OPTIONS: JobsProOptions = {
  removeOnComplete: REMOVE_AFTER_7_DAYS_OR_50_JOBS,
  removeOnFail: REMOVE_AFTER_30_DAYS,
  attempts: MAXIMUM_JOB_ATTEMPTS,
  backoff: {
    type: 'custom',
  },
}
