/**
 * Business rule: "Submit and exit" must respect the Confetti survey's
 * `required` setting. A required question that is unanswered keeps the user in
 * the AI builder, because users were skipping the survey and leaving.
 */
import { describe, expect, it } from 'vitest'

import {
  decideSubmit,
  isReadyToSubmit,
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

describe('isReadyToSubmit', () => {
  it('disables the button while required questions are incomplete', () => {
    expect(
      isReadyToSubmit({ completeness: false, hasLoadTimedOut: false }),
    ).toBe(false)
  })

  it('disables the button while the survey is loading', () => {
    expect(
      isReadyToSubmit({ completeness: null, hasLoadTimedOut: false }),
    ).toBe(false)
  })

  it('enables the button when Confetti reports completion', () => {
    expect(
      isReadyToSubmit({ completeness: true, hasLoadTimedOut: false }),
    ).toBe(true)
  })

  it('enables the button after the survey load timeout', () => {
    expect(isReadyToSubmit({ completeness: null, hasLoadTimedOut: true })).toBe(
      true,
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
        showRequiredError: true,
      }),
    ).toEqual(MISSING_ANSWER_ERROR)
  })

  it('treats a whitespace-only answer as blank', () => {
    expect(
      resolveQuestionError({
        question: { required: true },
        error: 'This field is required',
        answer: '   ',
        showRequiredError: true,
      }),
    ).toEqual(MISSING_ANSWER_ERROR)
  })

  it('clears the flag once the required question is answered', () => {
    expect(
      resolveQuestionError({
        question: { required: true },
        error: undefined,
        answer: 5,
        showRequiredError: true,
      }),
    ).toBeUndefined()
  })
})
