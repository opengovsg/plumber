import { createHash } from 'crypto'

const md5 = (value: string) => createHash('md5').update(value).digest('hex')

interface RepeatDelayedJobIdsParams {
  /** The `name` the repeatable job was added under, also our custom repeat key. */
  name: string
  /** The repeat zset member, i.e. `key` from `getRepeatableJobs()`. */
  key: string
  /** Next-run epoch millis, i.e. `next` from `getRepeatableJobs()`. */
  next: number
  /** The `jobId` the repeatable job was added with. */
  jobId: string
}

/**
 * Every id the delayed job holding a repeatable job's next occurrence could
 * have been enqueued under.
 *
 * bullmq derives that id from the repeat zset member, and the recipe differs
 * between 5.7.8 and 5.70.2 and by whether the member is our custom key or the
 * legacy `name:jobId:endDate:tz:pattern` concat. Redis records nothing that
 * says which recipe wrote the entry, so return all of them and let the caller
 * remove each one. Removing an id that was never enqueued is a no-op.
 */
export function getRepeatDelayedJobIds({
  name,
  key,
  next,
  jobId,
}: RepeatDelayedJobIdsParams): string[] {
  const checksums = new Set<string>()

  if (key.split(':').length > 2) {
    // Legacy concat member. 5.70.2 hashes the job data's `id` into the
    // checksum, which flow job data does not have, hence the empty string.
    checksums.add(md5(`${name}${md5(key)}`))
    checksums.add(md5(`${name}${jobId}${md5(key)}`))
  } else {
    checksums.add(key)
  }

  // 5.7.8 ignores the member entirely and uses `repeat.key` verbatim.
  checksums.add(name)

  return [...checksums].map((checksum) => `repeat:${checksum}:${next}`)
}
