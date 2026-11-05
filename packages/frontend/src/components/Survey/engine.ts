import type { SurveyConfig } from './config'

export type SeqFlow = 'pipe' | 'regular' | 'aiBuilder'
export type SeqTriggerType = 'completion' | 'abandon'

export type SuppressReason =
  | 'session_gate'
  | 'global_gate'
  | 'flow_cooldown'
  | 'csat_cooldown'
  | 'new_user'
  | 'expired'

export interface SeqCandidate {
  flow: SeqFlow
  type: SeqTriggerType
  expiresAt?: Date
}

export interface SurveyTrigger {
  isPausePoint: boolean
  seqCandidate?: SeqCandidate
}

export interface SurveyUserState {
  signupAt: Date | null
  lastPromptAt: Date | null
  lastCsatAt: Date | null
  lastSeqAt: Record<SeqFlow, Date | null>
}

export type SurveyDecision =
  | { type: 'NONE'; reason?: SuppressReason }
  | { type: 'CSAT' }
  | { type: 'SEQ'; flow: SeqFlow; trigger: SeqTriggerType }

export type ActiveSurvey = Exclude<SurveyDecision, { type: 'NONE' }>

const MS_PER_DAY = 24 * 60 * 60 * 1000

// A user who was never surveyed is treated as infinitely long ago.
function daysSince(date: Date | null, now: Date): number {
  if (!date) {
    return Infinity
  }
  return (now.getTime() - date.getTime()) / MS_PER_DAY
}

/**
 * The publish SEQ ignores every gate, so it must also not start the global
 * gate. Otherwise each publish would push CSAT out by 14 days.
 */
export function isAlwaysShown(
  survey: Pick<SeqCandidate, 'flow' | 'type'> | undefined,
  config: SurveyConfig,
): boolean {
  return (
    config.pipeCompletionAlwaysShows &&
    survey?.flow === 'pipe' &&
    survey.type === 'completion'
  )
}

export function evaluate({
  trigger,
  user,
  sessionPromptShown,
  config,
  now,
}: {
  trigger: SurveyTrigger
  user: SurveyUserState
  sessionPromptShown: boolean
  config: SurveyConfig
  now: Date
}): SurveyDecision {
  const candidate = trigger.seqCandidate
  if (candidate && isAlwaysShown(candidate, config)) {
    return { type: 'SEQ', flow: candidate.flow, trigger: candidate.type }
  }

  if (sessionPromptShown) {
    return { type: 'NONE', reason: 'session_gate' }
  }
  if (daysSince(user.lastPromptAt, now) < config.globalCooldownDays) {
    return { type: 'NONE', reason: 'global_gate' }
  }

  const isNewUser =
    daysSince(user.signupAt, now) < config.csatNewUserSuppressDays
  const csatAgeDays = daysSince(user.lastCsatAt, now)
  const csatDue =
    trigger.isPausePoint && !isNewUser && csatAgeDays >= config.csatCooldownDays

  if (csatDue && csatAgeDays >= config.csatOverdueDays) {
    return { type: 'CSAT' }
  }

  let seqSuppressReason: SuppressReason | undefined
  if (candidate) {
    if (candidate.expiresAt && candidate.expiresAt.getTime() <= now.getTime()) {
      seqSuppressReason = 'expired'
    } else if (
      daysSince(user.lastSeqAt[candidate.flow], now) <
      config.seqCooldownDaysPerFlow
    ) {
      seqSuppressReason = 'flow_cooldown'
    } else {
      return { type: 'SEQ', flow: candidate.flow, trigger: candidate.type }
    }
  }

  if (csatDue) {
    return { type: 'CSAT' }
  }
  if (seqSuppressReason) {
    return { type: 'NONE', reason: seqSuppressReason }
  }
  if (trigger.isPausePoint) {
    return { type: 'NONE', reason: isNewUser ? 'new_user' : 'csat_cooldown' }
  }
  return { type: 'NONE' }
}
