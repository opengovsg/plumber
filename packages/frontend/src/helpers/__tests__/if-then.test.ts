import { IStep } from '@plumber/types'

import { describe, expect, it } from 'vitest'

import {
  buildRegionList,
  computeJumpTargets,
  getEarlierBranchesStepIdToJumpTo,
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

describe('getEarlierBranchesStepIdToJumpTo', () => {
  it("points each branch except the last at the next branch's if-then", () => {
    const b1 = ifThen('b1')
    const b1a = step()
    const b2 = ifThen('b2')
    const b2a = step()
    const b3 = ifThen('b3')
    const b3a = step()

    expect(
      getEarlierBranchesStepIdToJumpTo([
        [b1, b1a],
        [b2, b2a],
        [b3, b3a],
      ]),
    ).toEqual([
      { stepId: 'b1', stepIdToJumpTo: 'b2' },
      { stepId: 'b2', stepIdToJumpTo: 'b3' },
    ])
  })

  it('returns an empty array for a single-branch block', () => {
    const b1 = ifThen('b1')
    const b1a = step()

    expect(getEarlierBranchesStepIdToJumpTo([[b1, b1a]])).toEqual([])
  })

  it('upgrades a legacy block so an added after-block step reads as its exit', () => {
    // A legacy if-then block (no branch carries a step to jump to) at the end
    // of the flow, with a step freshly added after it.
    const b1 = ifThen('b1')
    const b1a = step()
    const b2 = ifThen('b2')
    const b2a = step()
    const created = step({ id: 'created' })
    const steps = [b1, b1a, b2, b2a, created]

    // Before the handler's writes, the legacy block runs to the end of the flow
    // and swallows the new step into its last branch.
    const before = buildRegionList(steps, GROUPING_ACTIONS)
    expect(before.map((r) => r.type)).toEqual(['SingleSteps', 'Block'])
    expect(before[1]).toMatchObject({
      branches: [
        [b1, b1a],
        [b2, b2a, created],
      ],
    })

    // Apply exactly what the after-block handler writes: the last branch jumps
    // to the new step, and getEarlierBranchesStepIdToJumpTo chains the rest.
    b2.parameters = { ...b2.parameters, stepIdToJumpTo: 'created' }
    for (const { stepId, stepIdToJumpTo } of getEarlierBranchesStepIdToJumpTo([
      [b1, b1a],
      [b2, b2a],
    ])) {
      const branchStep = steps.find((s) => s.id === stepId)!
      branchStep.parameters = { ...branchStep.parameters, stepIdToJumpTo }
    }

    // Now the block exits at the new step: two branches, then a SingleSteps
    // region holding the added step.
    const after = buildRegionList(steps, GROUPING_ACTIONS)
    expect(after.map((r) => r.type)).toEqual([
      'SingleSteps',
      'Block',
      'SingleSteps',
    ])
    expect(after[1]).toMatchObject({
      branches: [
        [b1, b1a],
        [b2, b2a],
      ],
    })
    expect(after[2]).toEqual({ type: 'SingleSteps', steps: [created] })
  })
})
