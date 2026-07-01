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

// Convenience: the ids of every step within a region, flattened.
function regionStepIds(region: StepRegion): string[] {
  return region.type === 'SingleSteps'
    ? region.steps.map((s) => s.id)
    : region.branches.flatMap((branch) => branch.map((s) => s.id))
}

describe('buildRegionList', () => {
  it('returns a single (possibly empty) region when there are no action steps', () => {
    const regions = buildRegionList([], GROUPING_ACTIONS)
    expect(regions).toEqual([{ type: 'SingleSteps', steps: [] }])
  })

  it('groups a run of ordinary steps into one SingleSteps region', () => {
    const s1 = step()
    const s2 = step()
    const regions = buildRegionList([s1, s2], GROUPING_ACTIONS)
    expect(regions).toEqual([{ type: 'SingleSteps', steps: [s1, s2] }])
  })

  describe('legacy flows (no stepIdToJumpTo)', () => {
    it('treats a single if-then group as one trailing block (byte-identical to before)', () => {
      const before = step()
      const b1 = ifThen('b1')
      const b1a = step()
      const b2 = ifThen('b2')
      const b2a = step()
      const regions = buildRegionList(
        [before, b1, b1a, b2, b2a],
        GROUPING_ACTIONS,
      )

      expect(regions).toHaveLength(2)
      expect(regions[0]).toEqual({ type: 'SingleSteps', steps: [before] })
      expect(regions[1].type).toBe('Block')
      expect(regions[1]).toMatchObject({
        branches: [
          [b1, b1a],
          [b2, b2a],
        ],
      })
    })

    it('runs a legacy block to the end of the flow, absorbing later steps', () => {
      // Without stepIdToJumpTo, steps after the block are absorbed into it,
      // exactly as the old grouping code did.
      const b1 = ifThen('b1')
      const trailing = step()
      const regions = buildRegionList([b1, trailing], GROUPING_ACTIONS)

      expect(regions).toHaveLength(2)
      expect(regions[0]).toEqual({ type: 'SingleSteps', steps: [] })
      expect(regions[1]).toMatchObject({ branches: [[b1, trailing]] })
    })
  })

  describe('flows with stepIdToJumpTo', () => {
    it('ends a block at the after-block single step and resumes a SingleSteps region', () => {
      // before | b1 -> b2 (next if-then), b2 -> after (single step) | after
      const before = step()
      const b1 = ifThen('b1', 'b2')
      const b1a = step()
      const b2 = ifThen('b2', 'after')
      const b2a = step()
      const after = step({ id: 'after' })
      const regions = buildRegionList(
        [before, b1, b1a, b2, b2a, after],
        GROUPING_ACTIONS,
      )

      expect(regions.map((r) => r.type)).toEqual([
        'SingleSteps',
        'Block',
        'SingleSteps',
      ])
      expect(regions[0]).toEqual({ type: 'SingleSteps', steps: [before] })
      expect(regions[1]).toMatchObject({
        branches: [
          [b1, b1a],
          [b2, b2a],
        ],
      })
      expect(regions[2]).toEqual({ type: 'SingleSteps', steps: [after] })
    })

    it('chains a second block after an intervening single step', () => {
      // before | Block A (b1 -> after) | after | Block B (c1 absent => last)
      const before = step()
      const b1 = ifThen('b1', 'after')
      const b1a = step()
      const after = step({ id: 'after' })
      const c1 = ifThen('c1') // last block, last branch => no target
      const c1a = step()
      const regions = buildRegionList(
        [before, b1, b1a, after, c1, c1a],
        GROUPING_ACTIONS,
      )

      expect(regions.map((r) => r.type)).toEqual([
        'SingleSteps',
        'Block',
        'SingleSteps',
        'Block',
      ])
      expect(regionStepIds(regions[0])).toEqual([before.id])
      expect(regionStepIds(regions[1])).toEqual(['b1', b1a.id])
      expect(regionStepIds(regions[2])).toEqual(['after'])
      expect(regionStepIds(regions[3])).toEqual(['c1', c1a.id])
    })

    it('always begins with a (possibly empty) SingleSteps region for a block-first flow', () => {
      // trigger -> if-then with no steps before it: the leading region is empty,
      // matching the previous empty "steps before group".
      const b1 = ifThen('b1', 'after')
      const after = step({ id: 'after' })
      const regions = buildRegionList([b1, after], GROUPING_ACTIONS)

      expect(regions.map((r) => r.type)).toEqual([
        'SingleSteps',
        'Block',
        'SingleSteps',
      ])
      expect(regions[0]).toEqual({ type: 'SingleSteps', steps: [] })
      expect(regionStepIds(regions[1])).toEqual(['b1'])
      expect(regionStepIds(regions[2])).toEqual(['after'])
    })
  })

  describe('for-each', () => {
    it('treats a for-each as a last-step block running to the end', () => {
      const before = step()
      const fe = forEach('fe')
      const body = step()
      const regions = buildRegionList([before, fe, body], GROUPING_ACTIONS)

      expect(regions).toHaveLength(2)
      expect(regions[0]).toEqual({ type: 'SingleSteps', steps: [before] })
      expect(regions[1]).toMatchObject({ branches: [[fe, body]] })
    })
  })
})

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
