import type { IConditionRow, IMultiRowGroup } from '@plumber/types'

import { describe, expect, it } from 'vitest'

import StepError from '@/errors/step'

import { evaluateConditionGroups } from '../../common/evaluate-condition-groups'

function row(overrides: Partial<IConditionRow>): IConditionRow {
  return {
    field: 'a',
    is: 'is',
    condition: 'equals',
    text: 'a',
    ...overrides,
  }
}

function group(...rows: IConditionRow[]): IMultiRowGroup<IConditionRow> {
  return { rows }
}

describe('evaluateConditionGroups', () => {
  it('returns false for an empty group array', () => {
    expect(evaluateConditionGroups([])).toBe(false)
  })

  it('passes a single group with a single satisfied row', () => {
    expect(
      evaluateConditionGroups([group(row({ field: 'a', text: 'a' }))]),
    ).toBe(true)
  })

  it('AND-s rows within a group (all must pass)', () => {
    const bothTrue = group(
      row({ field: 'a', text: 'a' }),
      row({ field: 'b', text: 'b' }),
    )
    const oneFalse = group(
      row({ field: 'a', text: 'a' }),
      row({ field: 'b', text: 'c' }),
    )
    expect(evaluateConditionGroups([bothTrue])).toBe(true)
    expect(evaluateConditionGroups([oneFalse])).toBe(false)
  })

  it('OR-s across groups (any group passing is enough)', () => {
    const failingGroup = group(row({ field: 'a', text: 'mismatch' }))
    const passingGroup = group(row({ field: 'b', text: 'b' }))
    expect(evaluateConditionGroups([failingGroup, passingGroup])).toBe(true)
  })

  it('returns false when no group passes', () => {
    const groups = [
      group(row({ field: 'a', text: 'x' })),
      group(row({ field: 'b', text: 'y' })),
    ]
    expect(evaluateConditionGroups(groups)).toBe(false)
  })

  it('short-circuits: a malformed group after a matching one never throws', () => {
    const matching = group(row({ field: 'a', text: 'a' }))
    const malformed = group(row({ condition: 'not-a-real-operator' }))
    expect(evaluateConditionGroups([matching, malformed])).toBe(true)
  })

  it('fail-fast: throws a StepError naming the offending group index', () => {
    const failingGroup = group(row({ field: 'a', text: 'mismatch' }))
    const malformedGroup = group(row({ condition: 'not-a-real-operator' }))

    expect(() =>
      evaluateConditionGroups([failingGroup, malformedGroup]),
    ).toThrow(StepError)
    // The malformed group is the 2nd one (1-indexed) in the array.
    expect(() =>
      evaluateConditionGroups([failingGroup, malformedGroup]),
    ).toThrow(/condition group 2/)
  })
})
