import { JobsOptions } from 'bullmq'

export const REMOVE_AFTER_30_DAYS = {
  age: 30 * 24 * 3600,
}

export const REMOVE_AFTER_7_DAYS_OR_50_JOBS = {
  age: 7 * 24 * 3600,
  count: 50,
}

export const DEFAULT_JOB_DELAY_DURATION = 0
export const MAXIMUM_JOB_ATTEMPTS = 4

const EXPONENTIAL_BACKOFF_INITIAL_DELAY_MS = 5000

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  removeOnComplete: REMOVE_AFTER_7_DAYS_OR_50_JOBS,
  removeOnFail: REMOVE_AFTER_30_DAYS,
  attempts: MAXIMUM_JOB_ATTEMPTS,
  backoff: {
    type: 'exponential',
    delay: EXPONENTIAL_BACKOFF_INITIAL_DELAY_MS,
  },
}
