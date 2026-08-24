import { type IJSONObject } from '@plumber/types'
import { describe, expect, it } from 'vitest'

import {
  stepTransformer,
  transformIfThenConditions,
  transformOnlyContinueIfConditions,
} from '../../common/transform-step-parameters'

const { transformStepParameters, getLatestStepVersion } = stepTransformer

describe('transformIfThenConditions', () => {
  it('collapses a flat AND-list into exactly ONE group (never one-per-row)', () => {
    const oldRows = [
      { field: 'a', is: 'is', condition: 'equals', text: 'a' },
      { field: 'b', is: 'is', condition: 'equals', text: 'b' },
    ]
    const result = transformIfThenConditions({
      branchName: 'Branch 2',
      depth: 0,
      conditions: oldRows,
    })

    // The whole point: AND-ed rows stay together in one OR-group.
    expect(result.conditions).toEqual([{ rows: oldRows }])
    expect((result.conditions as unknown[]).length).toBe(1)
    // branchName / depth preserved.
    expect(result.branchName).toBe('Branch 2')
    expect(result.depth).toBe(0)
  })

  it('is idempotent: already-migrated grouped conditions are unchanged', () => {
    const migrated = {
      branchName: 'Branch 2',
      depth: 0,
      conditions: [
        { rows: [{ field: 'a', is: 'is', condition: 'equals', text: 'a' }] },
      ],
    }
    expect(transformIfThenConditions(migrated)).toEqual(migrated)
  })

  it('leaves parameters untouched when conditions is not an array', () => {
    const params = { branchName: 'Branch 2', depth: 0 }
    expect(transformIfThenConditions(params)).toBe(params)
  })

  it('treats an empty conditions array as already-migrated (no wrapping)', () => {
    const params: IJSONObject = {
      branchName: 'Branch 2',
      depth: 0,
      conditions: [],
    }
    expect(transformIfThenConditions(params)).toEqual(params)
  })
})

describe('transformOnlyContinueIfConditions', () => {
  it('wraps the root condition into one group with one row', () => {
    const result = transformOnlyContinueIfConditions({
      field: '1',
      is: 'is',
      condition: 'equals',
      text: '1',
    })

    expect(result).toEqual({
      conditions: [
        { rows: [{ field: '1', is: 'is', condition: 'equals', text: '1' }] },
      ],
    })
    // Root-level condition keys are moved out.
    expect(result).not.toHaveProperty('field')
    expect(result).not.toHaveProperty('condition')
  })

  it('preserves unrelated root keys (e.g. depth) while wrapping', () => {
    const result = transformOnlyContinueIfConditions({
      depth: 2,
      field: '1',
      is: 'is',
      condition: 'equals',
      text: '1',
    })
    expect(result.depth).toBe(2)
    expect(result.conditions).toEqual([
      { rows: [{ field: '1', is: 'is', condition: 'equals', text: '1' }] },
    ])
  })

  it('is idempotent: parameters with a conditions array are unchanged', () => {
    const migrated = {
      conditions: [
        { rows: [{ field: '1', is: 'is', condition: 'equals', text: '1' }] },
      ],
    }
    expect(transformOnlyContinueIfConditions(migrated)).toBe(migrated)
  })

  it('leaves unconfigured parameters (no field, no condition) untouched', () => {
    const params = { depth: 0 }
    expect(transformOnlyContinueIfConditions(params)).toBe(params)
  })
})

describe('stepTransformer wiring', () => {
  it('reports latest version 2 for both toolbox condition actions', () => {
    expect(getLatestStepVersion('ifThen')).toBe(2)
    expect(getLatestStepVersion('onlyContinueIf')).toBe(2)
  })

  it('defaults to version 1 for actions without a transformer', () => {
    expect(getLatestStepVersion('forEach')).toBe(1)
  })

  it('applies the v1→v2 transform at version 1 and is a no-op at version 2', () => {
    const v1 = {
      branchName: 'Branch 2',
      depth: 0,
      conditions: [{ field: 'a', is: 'is', condition: 'equals', text: 'a' }],
    }
    const migrated = transformStepParameters('ifThen', v1, 1)
    expect(migrated.conditions).toEqual([
      { rows: [{ field: 'a', is: 'is', condition: 'equals', text: 'a' }] },
    ])

    expect(transformStepParameters('ifThen', migrated, 2)).toEqual(migrated)
  })
})
