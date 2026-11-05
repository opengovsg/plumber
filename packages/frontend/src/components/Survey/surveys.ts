import { useRespondentState } from '@opengovsg/confetti'
import { useEffect } from 'react'

import appConfig from '@/config/app'

import { SURVEY_CONFIG } from './config'
import {
  ActiveSurvey,
  checkHistory,
  HistoryCheck,
  isAlwaysShown,
  lastActedAt,
} from './engine'
import { getSession, recordPrompt } from './storage'

export function surveyMetadata(survey: ActiveSurvey): Record<string, string> {
  if (survey.type === 'CSAT') {
    return { survey_type: 'csat' }
  }
  return {
    survey_type: 'seq',
    seq_source: survey.flow,
    seq_trigger: survey.trigger,
    ...(survey.pipeId && { pipe_id: survey.pipeId }),
  }
}

/** Metadata sent to Confetti with each response. */
export function responseMetadata(
  userId: string,
  survey: ActiveSurvey,
): Record<string, string> {
  return {
    ...surveyMetadata(survey),
    session_id: getSession(userId).sessionId,
    app_version: appConfig.version ?? 'unknown',
  }
}

/**
 * `key` keeps a distinct Confetti respondent per survey slot, because several
 * slots share one Confetti survey.
 */
export function surveyIdFor(survey: ActiveSurvey): { id: string; key: string } {
  const ids = appConfig.confettiSurveyIds
  if (survey.type === 'CSAT') {
    return { id: ids.csat, key: 'csat' }
  }
  switch (survey.flow) {
    case 'pipe':
      return { id: ids.seqPipe, key: 'seq-pipe' }
    case 'regular':
      return { id: ids.seqRegular, key: 'seq-regular' }
    case 'aiBuilder':
      return { id: ids.seqRegular, key: 'seq-ai-builder' }
  }
}

export function respondentFor(userId: string, survey: ActiveSurvey): string {
  return `${userId}-${surveyIdFor(survey).key}`
}

/**
 * The API serialises timestamps as epoch milliseconds, which `new Date()`
 * parses as an invalid date.
 */
export function parseApiTimestamp(
  value: string | null | undefined,
): Date | null {
  if (!value) {
    return null
  }
  const date = /^\d+$/.test(value) ? new Date(Number(value)) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Records that the user submitted or dismissed `survey` at `at`. */
export function recordActedOn(
  userId: string,
  survey: ActiveSurvey,
  at: Date,
): void {
  recordPrompt(
    userId,
    survey.type === 'CSAT'
      ? { type: 'csat' }
      : { type: 'seq', flow: survey.flow },
    at,
    { startsGlobalGate: !isAlwaysShown(survey, SURVEY_CONFIG) },
  )
}

/**
 * Checks Confetti's history for `survey`, so an action on another device
 * counts here too. A cooldown found there is copied into local state.
 */
export function useSurveyHistory(
  survey: ActiveSurvey,
  userId: string | undefined,
): HistoryCheck {
  // An empty respondent makes the hook return null without a request.
  const history = useRespondentState({
    surveyId: surveyIdFor(survey).id,
    publishableKey: appConfig.confettiSurveyPublishableKey,
    respondent: userId ? respondentFor(userId, survey) : '',
    proxyUrl: appConfig.confettiApiBaseUrl,
  })
  const check = checkHistory(survey, history, SURVEY_CONFIG, new Date())
  const actedAtMs = history ? lastActedAt(history)?.getTime() : undefined

  useEffect(() => {
    if (check === 'cooldown' && userId && actedAtMs !== undefined) {
      recordActedOn(userId, survey, new Date(actedAtMs))
    }
  }, [check, userId, actedAtMs, survey])

  return check
}
