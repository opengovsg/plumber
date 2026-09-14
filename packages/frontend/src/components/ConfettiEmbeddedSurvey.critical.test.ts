/**
 * Business rule: "Submit and exit" must respect the Confetti survey's
 * `required` setting. A required question that is unanswered keeps the user in
 * the AI builder, because users were skipping the survey and leaving.
 */
import { describe, expect, it } from 'vitest'

import {
  decideSubmit,
  MISSING_ANSWER_ERROR,
  resolveQuestionError,
} from './ConfettiEmbeddedSurvey.helpers'

describe('decideSubmit', () => {
  it('refuses to submit while a required question is unanswered', () => {
    expect(
      decideSubmit({ completeness: false, hasLoadTimedOut: false }),
    ).toEqual('incomplete')
    expect(
      decideSubmit({ completeness: false, hasLoadTimedOut: true }),
    ).toEqual('incomplete')
  })

  it('submits once every required question is answered', () => {
    expect(
      decideSubmit({ completeness: true, hasLoadTimedOut: false }),
    ).toEqual('submit')
  })

  it('refuses to submit while the survey is still loading', () => {
    expect(
      decideSubmit({ completeness: null, hasLoadTimedOut: false }),
    ).toEqual('loading')
  })

  it('submits without the survey once it has failed to arrive', () => {
    expect(decideSubmit({ completeness: null, hasLoadTimedOut: true })).toEqual(
      'submit',
    )
  })
})

describe('resolveQuestionError', () => {
  it('flags a required question the user left blank', () => {
    expect(
      resolveQuestionError({
        question: { required: true },
        error: 'Invalid input',
        answer: undefined,
        hasTriedSubmit: true,
      }),
    ).toEqual(MISSING_ANSWER_ERROR)
  })

  it('treats a whitespace-only answer as blank', () => {
    expect(
      resolveQuestionError({
        question: { required: true },
        error: 'This field is required',
        answer: '   ',
        hasTriedSubmit: true,
      }),
    ).toEqual(MISSING_ANSWER_ERROR)
  })

  it('clears the flag once the required question is answered', () => {
    expect(
      resolveQuestionError({
        question: { required: true },
        error: undefined,
        answer: 5,
        hasTriedSubmit: true,
      }),
    ).toBeUndefined()
  })
})
