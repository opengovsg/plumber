import { IStep } from '@plumber/types'

import { describe, expect, it } from 'vitest'

import { TOOLBOX_ACTIONS, TOOLBOX_APP_KEY } from '@/helpers/toolbox'

import { shouldCreateEmptyStep } from './utils'

function step(overrides: Partial<IStep> = {}): IStep {
  return {
    id: 'step-1',
    appKey: 'postman',
    key: 'sendTransactionalEmail',
    parameters: {},
    ...overrides,
  } as IStep
}

function ifThen(id: string, stepIdToJumpTo?: string | null): IStep {
  return step({
    id,
    appKey: TOOLBOX_APP_KEY,
    key: TOOLBOX_ACTIONS.IfThen,
    parameters: {
      depth: 0,
      ...(stepIdToJumpTo !== undefined ? { stepIdToJumpTo } : {}),
    },
  })
}

describe('shouldCreateEmptyStep', () => {
  it('creates a placeholder when the deleted step was the last step of a trailing branch', () => {
    expect(shouldCreateEmptyStep(ifThen('b1'), undefined)).toBe(true)
  })

  it('creates a placeholder when the deleted step was the only step between two branches', () => {
    expect(shouldCreateEmptyStep(ifThen('b1'), ifThen('b2'))).toBe(true)
  })

  it('creates a placeholder when the branch jumps to the next step (the deleted step was its only step)', () => {
    expect(
      shouldCreateEmptyStep(ifThen('b1', 'after'), step({ id: 'after' })),
    ).toBe(true)
  })

  it('does not create a placeholder when the next step is still inside the branch', () => {
    expect(
      shouldCreateEmptyStep(ifThen('b1', 'after'), step({ id: 'inner-2' })),
    ).toBe(false)
  })

  it('does not create a placeholder for legacy if-thens followed by a regular step', () => {
    expect(shouldCreateEmptyStep(ifThen('b1'), step({ id: 'inner-2' }))).toBe(
      false,
    )
  })

  it('does not create a placeholder when the previous step is not an if-then', () => {
    expect(shouldCreateEmptyStep(step({ id: 'prev' }), step())).toBe(false)
    expect(shouldCreateEmptyStep(undefined, step())).toBe(false)
  })
})
