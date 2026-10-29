export interface SurveyConfig {
  globalCooldownDays: number
  seqCooldownDaysPerFlow: number
  csatCooldownDays: number
  csatOverdueDays: number
  csatNewUserSuppressDays: number
  abandonQueueExpiryHours: number
  abandonSampleRate: number
  // Product decision: ask after every publish, ignoring every gate and cooldown.
  pipeCompletionAlwaysShows: boolean
}

export const SURVEY_CONFIG: SurveyConfig = {
  globalCooldownDays: 14,
  seqCooldownDaysPerFlow: 30,
  csatCooldownDays: 30,
  csatOverdueDays: 45,
  csatNewUserSuppressDays: 14,
  abandonQueueExpiryHours: 48,
  abandonSampleRate: 0.3,
  pipeCompletionAlwaysShows: true,
}
