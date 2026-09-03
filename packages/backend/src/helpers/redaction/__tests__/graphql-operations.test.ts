import { describe, expect, it } from 'vitest'

import { OPERATION_REDACTIONS } from '../graphql-operations'

describe('OPERATION_REDACTIONS', () => {
  it.each([
    'createConnection',
    'updateConnection',
    'setTableViewPassword',
    'verifyTableViewPassword',
  ])('blanks the whole blob for %s', (operation) => {
    expect(
      OPERATION_REDACTIONS[operation]({ input: { secret: 'sk-live-1' } }),
    ).toBe('[redacted]')
  })

  it.each([
    'createStep',
    'updateStep',
    'duplicateBranch',
    'dynamicAction',
    'createFlowWithSteps',
  ])('registers a callback for %s', (operation) => {
    expect(typeof OPERATION_REDACTIONS[operation]).toBe('function')
  })

  it('registers nothing else, because redaction is opt-in', () => {
    expect(Object.keys(OPERATION_REDACTIONS).sort()).toEqual([
      'createConnection',
      'createFlowWithSteps',
      'createStep',
      'duplicateBranch',
      'dynamicAction',
      'setTableViewPassword',
      'updateConnection',
      'updateStep',
      'verifyTableViewPassword',
    ])
  })

  it('does not register getDynamicData, which cannot resolve its app', () => {
    expect(OPERATION_REDACTIONS.getDynamicData).toBe(undefined)
  })
})
