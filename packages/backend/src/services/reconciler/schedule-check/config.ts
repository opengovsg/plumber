import cronParser from 'cron-parser'
import { z } from 'zod'

const MAX_MISSED_RUN_GRACE_SECONDS = 3600

function isValidCronPattern(pattern: string): boolean {
  try {
    cronParser.parseExpression(pattern)
    return true
  } catch {
    return false
  }
}

const scheduleCheckEnvSchema = z.object({
  // Scheduled pipes run at minute 0, so checks avoid it to stay off the busiest minute.
  RECONCILER_SCHEDULE_CHECK_CRON: z
    .string()
    .min(1)
    .refine(isValidCronPattern, 'Invalid cron pattern')
    .default('18,42 * * * *'),
  SCHEDULE_MISSED_RUN_GRACE_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_MISSED_RUN_GRACE_SECONDS)
    .default(900),
})

export interface ScheduleCheckConfig {
  checkCronPattern: string
  missedRunGraceSeconds: number
}

export function parseScheduleCheckConfig(
  env: Record<string, string | undefined>,
): ScheduleCheckConfig {
  const parsed = scheduleCheckEnvSchema.parse(env)
  return {
    checkCronPattern: parsed.RECONCILER_SCHEDULE_CHECK_CRON,
    missedRunGraceSeconds: parsed.SCHEDULE_MISSED_RUN_GRACE_SECONDS,
  }
}
