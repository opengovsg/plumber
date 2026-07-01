import { IStep } from '@plumber/types'

import { describe, expect, it } from 'vitest'

import {
  buildRegionList,
  computeJumpTargets,
  type StepRegion,
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
} from '@/helpers/toolbox'

// Grouping actions used by the region builder: both toolbox grouping actions.
const GROUPING_ACTIONS = new Set([
  `${TOOLBOX_APP_KEY}-${TOOLBOX_ACTIONS.IfThen}`,
  `${TOOLBOX_APP_KEY}-${TOOLBOX_ACTIONS.ForEach}`,
])

let stepCounter = 0
function step(overrides: Partial<IStep> = {}): IStep {
  stepCounter += 1
  return {
    id: overrides.id ?? `step-${stepCounter}`,
    appKey: 'postman',
    key: 'sendTransactionalEmail',
    position: stepCounter,
    parameters: {},
    ...overrides,
  } as IStep
}

function ifThen(id: string, stepIdToJumpTo?: string): IStep {
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

function forEach(id: string): IStep {
  return step({ id, appKey: TOOLBOX_APP_KEY, key: TOOLBOX_ACTIONS.ForEach })
}

describe('computeJumpTargets', () => {
  it('points each non-last branch at the next if-then and the last branch at the after-block step', () => {
    const b1 = ifThen('b1')
    const b1a = step()
    const b2 = ifThen('b2')
    const b2a = step()
    const after = step({ id: 'after' })
    const regions: StepRegion[] = [
      {
        type: 'Block',
        branches: [
          [b1, b1a],
          [b2, b2a],
        ],
      },
      { type: 'SingleSteps', steps: [after] },
    ]

    const targets = computeJumpTargets(regions)
    expect(targets.get('b1')).toBe('b2')
    expect(targets.get('b2')).toBe('after')
  })

  it('sets the last branch of a trailing block to null (stop execution)', () => {
    const b1 = ifThen('b1')
    const b2 = ifThen('b2')
    const regions: StepRegion[] = [{ type: 'Block', branches: [[b1], [b2]] }]

    const targets = computeJumpTargets(regions)
    expect(targets.get('b1')).toBe('b2')
    // null (not undefined) so the "stop" sentinel is always persisted.
    expect(targets.get('b2')).toBeNull()
    expect(targets.has('b2')).toBe(true)
  })

  it('points the last branch of a block at the first if-then of the following block', () => {
    const b1 = ifThen('b1')
    const single = step({ id: 'single' })
    const c1 = ifThen('c1')
    const regions: StepRegion[] = [
      { type: 'Block', branches: [[b1]] },
      { type: 'SingleSteps', steps: [single] },
      { type: 'Block', branches: [[c1]] },
    ]

    const targets = computeJumpTargets(regions)
    // Block A's last branch exits to the single step after it.
    expect(targets.get('b1')).toBe('single')
    // Block B is last, so its branch stops (null sentinel).
    expect(targets.get('c1')).toBeNull()
  })

  it('ignores for-each blocks', () => {
    const fe = forEach('fe')
    const body = step()
    const regions: StepRegion[] = [{ type: 'Block', branches: [[fe, body]] }]

    const targets = computeJumpTargets(regions)
    expect(targets.size).toBe(0)
  })

  it('round-trips with buildRegionList for a chained/after-block flow', () => {
    const b1 = ifThen('b1', 'b2')
    const b1a = step()
    const b2 = ifThen('b2', 'after')
    const b2a = step()
    const after = step({ id: 'after' })
    const steps = [b1, b1a, b2, b2a, after]

    const targets = computeJumpTargets(buildRegionList(steps, GROUPING_ACTIONS))
    // The recomputed targets match what the steps already store.
    expect(targets.get('b1')).toBe('b2')
    expect(targets.get('b2')).toBe('after')
  })
})
