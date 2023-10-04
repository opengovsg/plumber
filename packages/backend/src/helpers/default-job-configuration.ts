import { JobsOptions } from 'bullmq'

export const REMOVE_AFTER_30_DAYS = {
  age: 30 * 24 * 3600,
}

export const REMOVE_AFTER_7_DAYS_OR_50_JOBS = {
  age: 7 * 24 * 3600,
  count: 50,
}

export const DEFAULT_JOB_DELAY_DURATION = 0

const EXPONENTIAL_BACKOFF_INITIAL_DELAY_MS = 5000

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  removeOnComplete: REMOVE_AFTER_7_DAYS_OR_50_JOBS,
  removeOnFail: REMOVE_AFTER_30_DAYS,
  attempts: 4,
  backoff: {
    type: 'exponential',
    delay: EXPONENTIAL_BACKOFF_INITIAL_DELAY_MS,
  },
}
