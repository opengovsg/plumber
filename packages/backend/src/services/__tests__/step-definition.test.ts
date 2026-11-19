import { describe, expect, it } from 'vitest'

import { isUserVisible, lookupStepDefinition } from '../step-definition'

describe('lookupStepDefinition', () => {
  it('permits a visible action', () => {
    expect(
      lookupStepDefinition('postman', 'sendTransactionalEmail', 'action'),
    ).toMatchObject({
      kind: 'permitted',
      type: 'action',
      definition: { key: 'sendTransactionalEmail' },
    })
  })

  it('permits a visible trigger', () => {
    expect(
      lookupStepDefinition('formsg', 'newSubmission', 'trigger'),
    ).toMatchObject({
      kind: 'permitted',
      type: 'trigger',
      definition: { key: 'newSubmission' },
    })
  })

  it('marks the FormSG MRF submission action hidden', () => {
    expect(
      lookupStepDefinition('formsg', 'mrfSubmission', 'action'),
    ).toMatchObject({
      kind: 'hidden',
      type: 'action',
      definition: { key: 'mrfSubmission', hiddenFromUser: true },
    })
  })

  it.each([
    ['an unknown app', 'no-such-app', 'newSubmission', 'trigger'],
    ['an unknown key', 'formsg', 'noSuchKey', 'action'],
    [
      'a trigger key looked up as an action',
      'formsg',
      'newSubmission',
      'action',
    ],
    [
      'an action key looked up as a trigger',
      'formsg',
      'mrfSubmission',
      'trigger',
    ],
  ] as const)('reports %s as unknown', (_, appKey, key, type) => {
    expect(lookupStepDefinition(appKey, key, type)).toEqual({ kind: 'unknown' })
  })
})

describe('isUserVisible', () => {
  it('hides only definitions flagged hiddenFromUser', () => {
    expect(isUserVisible({ hiddenFromUser: true })).toBe(false)
    expect(isUserVisible({ hiddenFromUser: false })).toBe(true)
    expect(isUserVisible({})).toBe(true)
  })
})
