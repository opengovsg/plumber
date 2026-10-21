import { describe, expect, it } from 'vitest'

import { findPreviousExecutableStep } from '../../actions/mrf-submission/previous-executable-step'

const trigger = { id: 'trigger', position: 1 }

function plainStep(id: string, position: number) {
  return { id, position }
}

function rejectBranchStep(id: string, position: number, mrfStepId: string) {
  return {
    id,
    position,
    config: { approval: { branch: 'reject' as const, stepId: mrfStepId } },
  }
}

describe('findPreviousExecutableStep', () => {
  it('returns the nearest preceding step', () => {
    const nearest = plainStep('nearest', 3)
    const flowSteps = [trigger, plainStep('earlier', 2), nearest]

    expect(findPreviousExecutableStep(flowSteps, 4)).toEqual(nearest)
  })

  it('skips rejection-branch steps', () => {
    const mrfStep = plainStep('mrf-2', 2)
    const flowSteps = [
      trigger,
      mrfStep,
      rejectBranchStep('reject-1', 3, 'mrf-2'),
      rejectBranchStep('reject-2', 4, 'mrf-2'),
    ]

    expect(findPreviousExecutableStep(flowSteps, 5)).toEqual(mrfStep)
  })

  it('ignores steps at or after the given position', () => {
    const flowSteps = [trigger, plainStep('current', 2), plainStep('later', 3)]

    expect(findPreviousExecutableStep(flowSteps, 2)).toEqual(trigger)
  })

  it('does not rely on the input being ordered by position', () => {
    const nearest = plainStep('nearest', 3)
    const flowSteps = [nearest, trigger, plainStep('earlier', 2)]

    expect(findPreviousExecutableStep(flowSteps, 4)).toEqual(nearest)
  })

  it('returns undefined when nothing precedes the given position', () => {
    expect(findPreviousExecutableStep([plainStep('current', 1)], 1)).toBe(
      undefined,
    )
  })

  it('returns undefined when every preceding step is a rejection-branch step', () => {
    const flowSteps = [rejectBranchStep('reject', 1, 'mrf-2')]

    expect(findPreviousExecutableStep(flowSteps, 2)).toBe(undefined)
  })
})
