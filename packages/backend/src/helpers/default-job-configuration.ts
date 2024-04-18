import { JobsOptions } from 'bullmq'

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
// - Excel rate limit is 6 per 3 seconds
// - Excel pipes tend to spike at ~100 submissions per 3 second window
// - Each excel step takes 2 queries = ~3 excel steps progresses per window,
//   others get retried. Under high concurrency, we may half this number as all
//   steps share the same limiter.
// - So in the worst case, a step may need to be retried 100 / 1.5 ~= 60 times.
export const MAXIMUM_JOB_ATTEMPTS = 60

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  removeOnComplete: REMOVE_AFTER_7_DAYS_OR_50_JOBS,
  removeOnFail: REMOVE_AFTER_30_DAYS,
  attempts: MAXIMUM_JOB_ATTEMPTS,
  backoff: {
    type: 'custom',
  },
}
