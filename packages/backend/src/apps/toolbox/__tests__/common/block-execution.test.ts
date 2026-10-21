import { describe, expect, it } from 'vitest'

import {
  didConditionalStepSkip,
  getParentConditionalSteps,
} from '../../common/block-execution'

const trigger = { id: 'trigger', position: 1, appKey: 'formsg', key: 'newSub' }

function ifThenV2(id: string, position: number, endStepId: string) {
  return {
    id,
    position,
    appKey: 'toolbox',
    key: 'ifThen',
    config: { endStepId },
  }
}

function ifThenV1(id: string, position: number) {
  return { id, position, appKey: 'toolbox', key: 'ifThen', config: {} }
}

function onlyContinueIf(id: string, position: number) {
  return { id, position, appKey: 'toolbox', key: 'onlyContinueIf' }
}

function plainStep(id: string, position: number) {
  return {
    id,
    position,
    appKey: 'postman',
    key: 'sendTransactionalEmail',
  }
}

describe('getParentConditionalSteps', () => {
  it('returns the block if-then for a step inside its block', () => {
    const ifThen = ifThenV2('if-then', 2, 'child')
    const child = plainStep('child', 3)
    const flowSteps = [trigger, ifThen, child]

    expect(getParentConditionalSteps(flowSteps, child)).toEqual([ifThen])
  })

  it('includes every only-continue-if inside the block, ordered by position', () => {
    const ifThen = ifThenV2('if-then', 2, 'last-child')
    const firstOci = onlyContinueIf('oci-1', 3)
    const middleChild = plainStep('child', 4)
    const secondOci = onlyContinueIf('oci-2', 5)
    const lastChild = plainStep('last-child', 6)
    const flowSteps = [
      trigger,
      ifThen,
      firstOci,
      middleChild,
      secondOci,
      lastChild,
    ]

    expect(getParentConditionalSteps(flowSteps, lastChild)).toEqual([
      ifThen,
      firstOci,
      secondOci,
    ])
  })

  it('excludes an only-continue-if that sits outside the block', () => {
    const ifThen = ifThenV2('if-then', 2, 'child')
    const child = plainStep('child', 3)
    const outsideOci = onlyContinueIf('oci', 4)
    const flowSteps = [trigger, ifThen, child, outsideOci]

    expect(getParentConditionalSteps(flowSteps, child)).toEqual([ifThen])
  })

  it('returns the if-then for the block endStep itself', () => {
    const ifThen = ifThenV2('if-then', 2, 'end')
    const child = plainStep('child', 3)
    const endStep = plainStep('end', 4)
    const flowSteps = [trigger, ifThen, child, endStep]

    expect(getParentConditionalSteps(flowSteps, endStep)).toEqual([ifThen])
  })

  it('picks only the containing block when a flow has several', () => {
    const firstIfThen = ifThenV2('if-then-1', 2, 'child-1')
    const firstChild = plainStep('child-1', 3)
    const secondIfThen = ifThenV2('if-then-2', 4, 'child-2')
    const secondChild = plainStep('child-2', 5)
    const flowSteps = [
      trigger,
      firstIfThen,
      firstChild,
      secondIfThen,
      secondChild,
    ]

    expect(getParentConditionalSteps(flowSteps, secondChild)).toEqual([
      secondIfThen,
    ])
  })

  it.each([
    {
      label: 'a step before every block',
      flowSteps: () => {
        const before = plainStep('before', 2)
        return {
          flowSteps: [trigger, before, ifThenV2('if-then', 3, 'child')],
          step: before,
        }
      },
    },
    {
      label: 'a step after the block endStep',
      flowSteps: () => {
        const after = plainStep('after', 4)
        return {
          flowSteps: [
            trigger,
            ifThenV2('if-then', 2, 'child'),
            plainStep('child', 3),
            after,
          ],
          step: after,
        }
      },
    },
    {
      label: 'the block if-then itself',
      flowSteps: () => {
        const ifThen = ifThenV2('if-then', 2, 'child')
        return {
          flowSteps: [trigger, ifThen, plainStep('child', 3)],
          step: ifThen,
        }
      },
    },
    {
      label: 'an empty (self-referencing) block',
      flowSteps: () => {
        const ifThen = ifThenV2('if-then', 2, 'if-then')
        return { flowSteps: [trigger, ifThen], step: ifThen }
      },
    },
    {
      label: 'a step inside an if-then V1 extent (no marker)',
      flowSteps: () => {
        const child = plainStep('child', 3)
        return {
          flowSteps: [trigger, ifThenV1('if-then', 2), child],
          step: child,
        }
      },
    },
    {
      label: 'a dangling marker',
      flowSteps: () => {
        const child = plainStep('child', 3)
        return {
          flowSteps: [trigger, ifThenV2('if-then', 2, 'deleted'), child],
          step: child,
        }
      },
    },
    {
      label: 'a marker pointing before the if-then',
      flowSteps: () => {
        const later = plainStep('later', 4)
        return {
          flowSteps: [
            trigger,
            plainStep('earlier', 2),
            ifThenV2('if-then', 3, 'earlier'),
            later,
          ],
          step: later,
        }
      },
    },
  ])('returns nothing for $label', ({ flowSteps }) => {
    const { flowSteps: steps, step } = flowSteps()
    expect(getParentConditionalSteps(steps, step)).toEqual([])
  })
})

describe('didConditionalStepSkip', () => {
  it.each([
    {
      label: 'an if-then whose condition was not met',
      step: ifThenV2('if-then', 2, 'child'),
      executionStep: { isFailed: false, dataOut: { isConditionMet: false } },
    },
    {
      label: 'an only-continue-if whose condition was not met',
      step: onlyContinueIf('oci', 3),
      executionStep: { isFailed: false, dataOut: { result: false } },
    },
  ])('is true for $label', ({ step, executionStep }) => {
    expect(didConditionalStepSkip(step, executionStep)).toBe(true)
  })

  it.each([
    {
      label: 'an if-then whose condition was met',
      step: ifThenV2('if-then', 2, 'child'),
      executionStep: { isFailed: false, dataOut: { isConditionMet: true } },
    },
    {
      label: 'an only-continue-if whose condition was met',
      step: onlyContinueIf('oci', 3),
      executionStep: { isFailed: false, dataOut: { result: true } },
    },
    {
      label: 'a failed if-then',
      step: ifThenV2('if-then', 2, 'child'),
      executionStep: { isFailed: true, dataOut: { isConditionMet: false } },
    },
    {
      label: 'a step that has not run',
      step: ifThenV2('if-then', 2, 'child'),
      executionStep: undefined,
    },
    {
      label: 'an if-then with no dataOut',
      step: ifThenV2('if-then', 2, 'child'),
      executionStep: { isFailed: false, dataOut: null },
    },
    {
      label: 'a stringified condition result',
      step: ifThenV2('if-then', 2, 'child'),
      executionStep: { isFailed: false, dataOut: { isConditionMet: 'false' } },
    },
    {
      label: 'a step that is not conditional',
      step: plainStep('child', 3),
      executionStep: { isFailed: false, dataOut: { isConditionMet: false } },
    },
  ])('is false for $label', ({ step, executionStep }) => {
    expect(didConditionalStepSkip(step, executionStep)).toBe(false)
  })
})
