import appConfig from '@/config/app'

import type { ActiveSurvey } from './engine'
import { getSession } from './storage'

export function surveyMetadata(survey: ActiveSurvey): Record<string, string> {
  if (survey.type === 'CSAT') {
    return { survey_type: 'csat' }
  }
  return {
    survey_type: 'seq',
    flow_id: survey.flow,
    seq_trigger: survey.trigger,
  }
}

/** Metadata sent to Confetti with each response. */
export function responseMetadata(survey: ActiveSurvey): Record<string, string> {
  return {
    ...surveyMetadata(survey),
    session_id: getSession().sessionId,
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
