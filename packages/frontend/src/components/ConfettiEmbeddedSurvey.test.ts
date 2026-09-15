import { describe, expect, it } from 'vitest'

import {
  isAnswered,
  resolveQuestionError,
} from './ConfettiEmbeddedSurvey.helpers'

describe('isAnswered', () => {
  it.each([
    ['undefined', undefined],
    ['an empty string', ''],
    ['whitespace', ' \n '],
    ['an empty selection', []],
  ])('treats %s as unanswered', (_label, answer) => {
    expect(isAnswered(answer)).toBe(false)
  })

  it.each([
    ['a rating', 1],
    ['text', 'Needs fewer steps'],
    ['a selection', ['Speed']],
    ['a bug report', { title: 'Broken step' }],
  ])('treats %s as answered', (_label, answer) => {
    expect(isAnswered(answer)).toBe(true)
  })
})

describe('resolveQuestionError', () => {
  it('shows nothing before Confetti reports the survey as incomplete', () => {
    expect(
      resolveQuestionError({
        question: { required: true },
        error: 'Invalid input',
        answer: undefined,
        showRequiredError: false,
      }),
    ).toBeUndefined()
  })

  it('leaves an optional question unflagged', () => {
    expect(
      resolveQuestionError({
        question: { required: false },
        error: undefined,
        answer: undefined,
        showRequiredError: true,
      }),
    ).toBeUndefined()
  })

  it("passes through Confetti's own validation message", () => {
    expect(
      resolveQuestionError({
        question: { required: true },
        error: 'Please enter less than 1000 characters',
        answer: 'a long answer',
        showRequiredError: true,
      }),
    ).toEqual('Please enter less than 1000 characters')
  })
})
