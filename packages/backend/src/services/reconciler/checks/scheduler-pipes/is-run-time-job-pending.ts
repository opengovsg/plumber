import type { Redis } from 'ioredis'

import { getRepeatDelayedJobIds } from '@/helpers/repeatable-jobs'

export const FLOW_QUEUE_KEY_PREFIX = '{flowQ}:flow'

interface IsRunTimeJobPendingInput {
  jobsRedis: Pick<Redis, 'hmget'>
  flowId: string
  scheduleEntryMember: string
  runTimeMillis: number
}

export async function isRunTimeJobPending({
  jobsRedis,
  flowId,
  scheduleEntryMember,
  runTimeMillis,
}: IsRunTimeJobPendingInput): Promise<boolean> {
  // Entries in the older member format map to several possible job IDs.
  const jobIds = getRepeatDelayedJobIds({
    name: `flow-${flowId}`,
    key: scheduleEntryMember,
    next: runTimeMillis,
    jobId: flowId,
  })

  for (const jobId of jobIds) {
    // HMGET returns null for a missing hash and a missing field alike, so `timestamp` proves the job exists.
    const [timestamp, processedOn] = await jobsRedis.hmget(
      `${FLOW_QUEUE_KEY_PREFIX}:${jobId}`,
      'timestamp',
      'processedOn',
    )
    if (timestamp !== null) {
      return processedOn === null
    }
  }

  return false
}
