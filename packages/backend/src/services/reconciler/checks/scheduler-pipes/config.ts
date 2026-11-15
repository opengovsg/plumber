import { z } from 'zod'

const MAX_MISSED_RUN_GRACE_SECONDS = 3600

const schedulerPipesCheckEnvSchema = z.object({
  SCHEDULE_MISSED_RUN_GRACE_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_MISSED_RUN_GRACE_SECONDS)
    .default(900),
})

export interface SchedulerPipesCheckConfig {
  missedRunGraceSeconds: number
}

export function parseSchedulerPipesCheckConfig(
  env: Record<string, string | undefined>,
): SchedulerPipesCheckConfig {
  const parsed = schedulerPipesCheckEnvSchema.parse(env)
  return {
    missedRunGraceSeconds: parsed.SCHEDULE_MISSED_RUN_GRACE_SECONDS,
  }
}
