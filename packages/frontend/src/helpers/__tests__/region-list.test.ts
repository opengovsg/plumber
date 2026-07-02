import { IStep } from '@plumber/types'

import { describe, expect, it } from 'vitest'

import {
  buildRegionList,
  isStepWithinForEachBlock,
  isStepWithinIfThenBlock,
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

describe('isStepWithinIfThenBlock', () => {
  // before | b1 (-> b2), b1a | b2 (-> after), b2a | after
  const before = step({ id: 'before' })
  const b1 = ifThen('b1', 'b2')
  const b1a = step({ id: 'b1a' })
  const b2 = ifThen('b2', 'after')
  const b2a = step({ id: 'b2a' })
  const after = step({ id: 'after' })
  const regions = buildRegionList(
    [before, b1, b1a, b2, b2a, after],
    GROUPING_ACTIONS,
  )

  it('returns true for a branch if-then and for a step inside a branch', () => {
    expect(isStepWithinIfThenBlock(regions, 'b1')).toBe(true)
    expect(isStepWithinIfThenBlock(regions, 'b1a')).toBe(true)
    expect(isStepWithinIfThenBlock(regions, 'b2a')).toBe(true)
  })

  it('returns false for single steps before and after the block', () => {
    expect(isStepWithinIfThenBlock(regions, 'before')).toBe(false)
    expect(isStepWithinIfThenBlock(regions, 'after')).toBe(false)
  })

  it('returns false for steps inside a for-each block', () => {
    const fe = forEach('fe')
    const body = step({ id: 'body' })
    const forEachRegions = buildRegionList([fe, body], GROUPING_ACTIONS)

    expect(isStepWithinIfThenBlock(forEachRegions, 'fe')).toBe(false)
    expect(isStepWithinIfThenBlock(forEachRegions, 'body')).toBe(false)
  })

  it('returns true for if-then branches nested inside a for-each block', () => {
    // fe, body | nested if-then branches: n1, n1a | n2, n2a
    const fe = forEach('fe')
    const body = step({ id: 'body' })
    const n1 = ifThen('n1', 'n2')
    const n1a = step({ id: 'n1a' })
    const n2 = ifThen('n2', null)
    const n2a = step({ id: 'n2a' })
    const forEachRegions = buildRegionList(
      [fe, body, n1, n1a, n2, n2a],
      GROUPING_ACTIONS,
    )

    // The for-each's own body stays selectable...
    expect(isStepWithinIfThenBlock(forEachRegions, 'fe')).toBe(false)
    expect(isStepWithinIfThenBlock(forEachRegions, 'body')).toBe(false)
    // ...but the nested if-then branches are not.
    expect(isStepWithinIfThenBlock(forEachRegions, 'n1')).toBe(true)
    expect(isStepWithinIfThenBlock(forEachRegions, 'n1a')).toBe(true)
    expect(isStepWithinIfThenBlock(forEachRegions, 'n2a')).toBe(true)
  })

  it('returns false when no step id is given', () => {
    expect(isStepWithinIfThenBlock(regions, undefined)).toBe(false)
  })
})

describe('isStepWithinForEachBlock', () => {
  // before | fe, body (with nested if-then branch n1)
  const before = step({ id: 'before' })
  const fe = forEach('fe')
  const body = step({ id: 'body' })
  const n1 = ifThen('n1')
  const n1a = step({ id: 'n1a' })
  const regions = buildRegionList([before, fe, body, n1, n1a], GROUPING_ACTIONS)

  it('returns true for any step inside the for-each, including nested if-then branches', () => {
    expect(isStepWithinForEachBlock(regions, 'fe')).toBe(true)
    expect(isStepWithinForEachBlock(regions, 'body')).toBe(true)
    expect(isStepWithinForEachBlock(regions, 'n1')).toBe(true)
    expect(isStepWithinForEachBlock(regions, 'n1a')).toBe(true)
  })

  it('returns false for steps outside the for-each and for if-then blocks', () => {
    expect(isStepWithinForEachBlock(regions, 'before')).toBe(false)

    const b1 = ifThen('b1', 'after')
    const after = step({ id: 'after' })
    const ifThenRegions = buildRegionList([b1, after], GROUPING_ACTIONS)
    expect(isStepWithinForEachBlock(ifThenRegions, 'b1')).toBe(false)
  })

  it('returns false when no step id is given', () => {
    expect(isStepWithinForEachBlock(regions, undefined)).toBe(false)
  })
})
