import { IStep } from '@plumber/types'
import { describe, expect, it } from 'vitest'

import { isOnlyContinueIfStep } from '@/helpers/toolbox'

function makeStep(overrides: Partial<IStep> = {}): IStep {
  return {
    id: 'step-1',
    type: 'action',
    position: 2,
    appKey: 'toolbox',
    key: 'onlyContinueIf',
    parameters: {},
    config: {},
    ...overrides,
  } as IStep
}

describe('isOnlyContinueIfStep', () => {
  it('is true for a toolbox "Only continue if" step', () => {
    expect(isOnlyContinueIfStep(makeStep())).toBe(true)
  })

  it('is false for an if-then step', () => {
    expect(isOnlyContinueIfStep(makeStep({ key: 'ifThen' }))).toBe(false)
  })

  it('is false for a for-each step', () => {
    expect(isOnlyContinueIfStep(makeStep({ key: 'forEach' }))).toBe(false)
  })

  it('is false for a non-toolbox step with the same key', () => {
    expect(isOnlyContinueIfStep(makeStep({ appKey: 'formsg' }))).toBe(false)
  })
})
