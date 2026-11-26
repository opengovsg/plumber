import { EXPORT_APP_ENVS } from 'backend-analytics'

interface BackfillOptions {
  s3: boolean
  appEnv: string
  logGroupOverride: string | undefined
  lastDay: string
  yesterday: string
}

/**
 * Guards a manual mutation log backfill that writes to the analytics bucket.
 *
 * IMPORTANT: a completion file marks a day done, so S3 takes finished days only.
 * The source log group stays paired with the bucket's environment.
 */
export function checkMutationLogBackfill({
  s3,
  appEnv,
  logGroupOverride,
  lastDay,
  yesterday,
}: BackfillOptions): void {
  if (!s3) {
    return
  }
  // Without this, the export would skip the environment and the command would exit 0 having written nothing.
  if (!EXPORT_APP_ENVS.has(appEnv)) {
    throw new Error(
      `--s3 runs only when APP_ENV is prod or staging, not ${appEnv}.`,
    )
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
