/**
 * Business rule: "Submit and exit" must respect the Confetti survey's
 * `required` setting. A required question that is unanswered keeps the user in
 * the AI builder, because users were skipping the survey and leaving.
 */
import { describe, expect, it } from 'vitest'

import {
  isReadyToSubmit,
  resolveSubmit,
} from './ConfettiEmbeddedSurvey.helpers'

const loaded = { isLoaded: true, hasLoadTimedOut: false }
const loading = { isLoaded: false, hasLoadTimedOut: false }
const timedOut = { isLoaded: false, hasLoadTimedOut: true }

describe('resolveSubmit', () => {
  it('keeps the user when Confetti refuses an unanswered required question', () => {
    expect(resolveSubmit({ ...loaded, submit: () => false })).toBe(false)
  })

  it('lets the user leave once Confetti accepts the response', () => {
    expect(resolveSubmit({ ...loaded, submit: () => true })).toBe(true)
  })

  it('keeps the user while the survey is still loading', () => {
    expect(resolveSubmit({ ...loading, submit: () => true })).toBe(false)
  })

  it('lets the user leave when the survey never arrives', () => {
    expect(resolveSubmit({ ...timedOut, submit: undefined })).toBe(true)
  })
})

describe('isReadyToSubmit', () => {
  it.each([
    ['loading', loading, false],
    ['loaded', loaded, true],
    ['timed out', timedOut, true],
  ])('when %s, returns %s', (_label, state, expected) => {
    expect(isReadyToSubmit(state)).toBe(expected)
  })
})
