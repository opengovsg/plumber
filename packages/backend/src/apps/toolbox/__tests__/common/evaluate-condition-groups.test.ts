import type { IConditionRow, IMultiRowGroup } from '@plumber/types'
import { describe, expect, it } from 'vitest'

import StepError from '@/errors/step'

import {
  MAX_CONDITION_GROUPS,
  MAX_ROWS_PER_CONDITION_GROUP,
} from '../../common/condition-group-limits'
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

  it('evaluates 100 contains rows on adversarial 1 MB operands in bounded time', () => {
    const field = 'a'.repeat(1_000_000)
    const text = 'a'.repeat(10) + 'b' + 'a'.repeat(500_000)
    // Each group's last row fails, so every row of every group runs.
    const groups = Array.from({ length: MAX_CONDITION_GROUPS }, () =>
      group(
        ...Array.from({ length: MAX_ROWS_PER_CONDITION_GROUP - 1 }, () =>
          row({ field, is: 'not', condition: 'contains', text }),
        ),
        row({ field, is: 'is', condition: 'contains', text }),
      ),
    )

    const start = performance.now()
    const result = evaluateConditionGroups(groups)
    const elapsedMs = performance.now() - start

    expect(result).toBe(false)
    expect(elapsedMs).toBeLessThan(5_000)
  })

  function catchStepError(groups: IMultiRowGroup<IConditionRow>[]): StepError {
    try {
      evaluateConditionGroups(groups)
    } catch (err) {
      if (err instanceof StepError) {
        return err
      }
      throw err
    }
    throw new Error('Expected a StepError')
  }

  it('rethrows an inner StepError unchanged, keeping its kind and name', () => {
    const err = catchStepError([
      group(
        row({ field: 'a', text: 'a' }),
        row({ condition: 'gt', text: '1' }),
      ),
    ])

    expect(err.kind).toBe('config')
    expect(JSON.parse(err.message)).toEqual({
      name: 'Error in condition group 1: Non-number used in field for comparison',
      solution: 'Check that the condition has been configured properly.',
      kind: 'config',
    })
  })

  it('wraps a non-StepError inner throw as internal', () => {
    const err = catchStepError([
      group(row({ field: 'a', text: 'mismatch' })),
      group(row({ field: undefined, condition: 'contains', text: 'a' })),
    ])

    expect(err.kind).toBe('internal')
    expect(JSON.parse(err.message)).toEqual({
      name: "Error in condition group 2: Cannot read properties of undefined (reading 'toString')",
      solution: 'Check that the condition has been configured properly.',
      kind: 'internal',
    })
  })
})
