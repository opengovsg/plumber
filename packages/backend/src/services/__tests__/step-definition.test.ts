import { describe, expect, it } from 'vitest'

import { isUserVisible, lookupStepDefinition } from '../step-definition'

describe('lookupStepDefinition', () => {
  it('permits a visible action', () => {
    const lookup = lookupStepDefinition('postman', 'sendTransactionalEmail')

    expect(lookup).toMatchObject({
      kind: 'permitted',
      definition: { key: 'sendTransactionalEmail' },
    })
  })

  it('permits a visible trigger', () => {
    const lookup = lookupStepDefinition('formsg', 'newSubmission')

    expect(lookup).toMatchObject({
      kind: 'permitted',
      definition: { key: 'newSubmission' },
    })
  })

  it('marks the FormSG MRF submission action hidden', () => {
    const lookup = lookupStepDefinition('formsg', 'mrfSubmission')

    expect(lookup).toMatchObject({
      kind: 'hidden',
      definition: { key: 'mrfSubmission', hiddenFromUser: true },
    })
  })

  it('reports an unknown app', () => {
    expect(lookupStepDefinition('no-such-app', 'newSubmission')).toEqual({
      kind: 'unknown',
    })
  })

  it('reports an unknown key on a known app', () => {
    expect(lookupStepDefinition('formsg', 'noSuchKey')).toEqual({
      kind: 'unknown',
    })
  })
})

describe('isUserVisible', () => {
  it('hides only definitions flagged hiddenFromUser', () => {
    expect(isUserVisible({ hiddenFromUser: true })).toBe(false)
    expect(isUserVisible({ hiddenFromUser: false })).toBe(true)
    expect(isUserVisible({})).toBe(true)
  })
})
