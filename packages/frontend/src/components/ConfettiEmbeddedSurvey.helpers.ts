import type { Answer, Question } from '@opengovsg/confetti'

// Confetti reports an unanswered required rating as "Invalid input", which
// reads like a broken widget rather than a skipped question.
export const MISSING_ANSWER_ERROR = 'This field is required'

/**
 * Confetti's verdict on whether every visible required question is answered.
 * Null until the survey renders, which covers both a slow load and a survey
 * that never arrives.
 */
export type SurveyCompleteness = boolean | null

export type SubmitDecision = 'submit' | 'incomplete' | 'loading'

export function decideSubmit({
  completeness,
  hasLoadTimedOut,
}: {
  completeness: SurveyCompleteness
  hasLoadTimedOut: boolean
}): SubmitDecision {
  if (completeness === false) {
    return 'incomplete'
  }
  // A survey that never arrives must not strand the user in the builder, but
  // one that is merely slow must not wave them past a required question.
  if (completeness === null) {
    return hasLoadTimedOut ? 'submit' : 'loading'
  }
  return 'submit'
}

export function isAnswered(answer: Answer | undefined): boolean {
  if (answer === undefined || answer === null) {
    return false
  }
  if (typeof answer === 'string') {
    return answer.trim().length > 0
  }
  if (Array.isArray(answer)) {
    return answer.length > 0
  }
  return true
}

export function resolveQuestionError({
  question,
  error,
  answer,
  hasTriedSubmit,
}: {
  question: Pick<Question, 'required'>
  error: string | undefined
  answer: Answer | undefined
  hasTriedSubmit: boolean
}): string | undefined {
  // Confetti validates each question as it mounts, so an unanswered required
  // question is already errored before the user touches anything.
  if (!hasTriedSubmit) {
    return undefined
  }
  if (question.required && !isAnswered(answer)) {
    return MISSING_ANSWER_ERROR
  }
  return error
}
