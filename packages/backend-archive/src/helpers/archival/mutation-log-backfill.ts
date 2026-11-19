interface BackfillOptions {
  s3: boolean
  logGroupOverride: string | undefined
  lastDay: string
  yesterday: string
}

/**
 * Guards a manual mutation log backfill that writes to the analytics bucket.
 *
 * IMPORTANT: the nightly run treats the latest day file as complete, so S3 takes finished days only.
 * The source log group stays paired with the bucket's environment.
 */
export function checkMutationLogBackfill({
  s3,
  logGroupOverride,
  lastDay,
  yesterday,
}: BackfillOptions): void {
  if (!s3) {
    return
  }
  if (logGroupOverride) {
    throw new Error(
      '--log-group works with --out only. --s3 reads ANALYTICS_REQUEST_LOG_GROUP, the log group of the bucket being written.',
    )
  }
  if (lastDay > yesterday) {
    throw new Error(
      `--s3 writes finished Singapore days only. ${lastDay} is after ${yesterday}.`,
    )
  }
}
