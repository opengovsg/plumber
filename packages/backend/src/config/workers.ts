export const WORKER_CONCURRENCY = {
  'm365-excel': 3,
  postman: 3,
  'postman-sms': 3,
  slack: 3,
  'telegram-bot': 3,
  tiles: 3,
}

// Maximum number of jobs the m365-excel batch worker collapses into a single
// multi-row Graph insert. Also used as the batch queue's group concurrency cap
// (group.concurrency === batch.size). See make-action-batch-worker.ts.
export const M365_BATCH_SIZE = Number(process.env.M365_BATCH_SIZE ?? '10')

if (!Number.isInteger(M365_BATCH_SIZE) || M365_BATCH_SIZE < 1) {
  throw new Error(
    'M365_BATCH_SIZE environment variable must be a positive integer!',
  )
}
