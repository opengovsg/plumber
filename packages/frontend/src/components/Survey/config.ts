export interface SurveyConfig {
  globalCooldownDays: number
  seqCooldownDaysPerFlow: number
  csatCooldownDays: number
  csatOverdueDays: number
  csatNewUserSuppressDays: number
  abandonQueueExpiryHours: number
  // Product decision: ask after every publish, ignoring every gate and cooldown.
  pipeCompletionAlwaysShows: boolean
}

export const SURVEY_CONFIG: SurveyConfig = {
  globalCooldownDays: 14,
  seqCooldownDaysPerFlow: 14,
  csatCooldownDays: 14,
  csatOverdueDays: 45,
  csatNewUserSuppressDays: 14,
  abandonQueueExpiryHours: 48,
  pipeCompletionAlwaysShows: true,
}
