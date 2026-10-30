import { z } from 'zod'

const MAX_MISSED_RUN_GRACE_SECONDS = 3600

const scheduleCheckEnvSchema = z.object({
  SCHEDULE_MISSED_RUN_GRACE_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_MISSED_RUN_GRACE_SECONDS)
    .default(900),
})

export interface ScheduleCheckConfig {
  missedRunGraceSeconds: number
}

export function parseScheduleCheckConfig(
  env: Record<string, string | undefined>,
): ScheduleCheckConfig {
  const parsed = scheduleCheckEnvSchema.parse(env)
  return {
    missedRunGraceSeconds: parsed.SCHEDULE_MISSED_RUN_GRACE_SECONDS,
  }
}
