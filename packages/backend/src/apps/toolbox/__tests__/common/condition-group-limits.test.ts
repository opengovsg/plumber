import { describe, expect, it } from 'vitest'

import { BadUserInputError } from '@/errors/graphql-errors'

import {
  MAX_CONDITION_GROUPS,
  MAX_ROWS_PER_CONDITION_GROUP,
  validateConditionGroupParameters,
} from '../../common/condition-group-limits'

const row = { field: 'a', is: 'is', condition: 'equals', text: 'a' }
const group = (numRows: number) => ({
  rows: Array.from({ length: numRows }, () => row),
})

describe('validateConditionGroupParameters', () => {
  it('accepts a valid grouped payload within the caps', () => {
    expect(() =>
      validateConditionGroupParameters({
        branchName: 'Branch 1',
        depth: 0,
        conditions: [group(1), group(MAX_ROWS_PER_CONDITION_GROUP)],
      }),
    ).not.toThrow()
  })

  it('accepts parameters without conditions (unconfigured / incomplete)', () => {
    expect(() => validateConditionGroupParameters({})).not.toThrow()
    // Legacy onlyContinueIf root shape passes through untouched (transform runs later).
    expect(() =>
      validateConditionGroupParameters({
        field: '1',
        is: 'is',
        condition: 'equals',
        text: '1',
      }),
    ).not.toThrow()
  })

  it('rejects more than the max number of groups', () => {
    expect(() =>
      validateConditionGroupParameters({
        conditions: Array.from({ length: MAX_CONDITION_GROUPS + 1 }, () =>
          group(1),
        ),
      }),
    ).toThrow(BadUserInputError)
  })

  it('rejects a group with more than the max rows', () => {
    expect(() =>
      validateConditionGroupParameters({
        conditions: [group(MAX_ROWS_PER_CONDITION_GROUP + 1)],
      }),
    ).toThrow(BadUserInputError)
  })

  it('rejects a malformed conditions value (not an array of groups)', () => {
    expect(() =>
      validateConditionGroupParameters({ conditions: 'nope' }),
    ).toThrow(BadUserInputError)
    expect(() =>
      validateConditionGroupParameters({ conditions: [{ notRows: [] }] }),
    ).toThrow(BadUserInputError)
  })
})
