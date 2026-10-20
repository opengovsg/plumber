import { z } from 'zod'

const MAX_MISSED_RUN_GRACE_SECONDS = 3600

const scheduleCheckEnvSchema = z.object({
  RECONCILER_SCHEDULE_CHECK_INTERVAL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(300),
  SCHEDULE_MISSED_RUN_GRACE_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_MISSED_RUN_GRACE_SECONDS)
    .default(900),
})

export interface ScheduleCheckConfig {
  checkIntervalSeconds: number
  missedRunGraceSeconds: number
}

export function parseScheduleCheckConfig(
  env: Record<string, string | undefined>,
): ScheduleCheckConfig {
  const parsed = scheduleCheckEnvSchema.parse(env)
  return {
    checkIntervalSeconds: parsed.RECONCILER_SCHEDULE_CHECK_INTERVAL_SECONDS,
    missedRunGraceSeconds: parsed.SCHEDULE_MISSED_RUN_GRACE_SECONDS,
  }
}
