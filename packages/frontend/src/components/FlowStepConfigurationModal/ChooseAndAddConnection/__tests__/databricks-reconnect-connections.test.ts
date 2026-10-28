import { describe, expect, it } from 'vitest'

import {
  databricksGeneration,
  databricksReconnectConnections,
  databricksReconnectDropdownConnections,
  pickDatabricksConnection,
} from '../databricks-reconnect-connections'

const legacy = { id: 'legacy-id', generation: 'legacy' as const }
const created = { id: 'new-id', generation: 'new' as const }

describe('databricksReconnectConnections', () => {
  it('returns the stored row when that id is in the list', () => {
    expect(
      databricksReconnectConnections([legacy, created], 'legacy-id'),
    ).toEqual([legacy])
  })

  it('returns the new row when the stored id is absent', () => {
    expect(
      databricksReconnectConnections([legacy, created], 'transferred-id'),
    ).toEqual([created])
  })

  it('returns the legacy row when the stored id is absent and no new row is listed', () => {
    expect(databricksReconnectConnections([legacy], 'transferred-id')).toEqual([
      legacy,
    ])
  })

  it('returns nothing for an empty list', () => {
    expect(databricksReconnectConnections([], 'transferred-id')).toEqual([])
  })
})

describe('pickDatabricksConnection', () => {
  it('prefers the new row over the legacy row', () => {
    expect(pickDatabricksConnection([legacy, created])).toEqual(created)
  })

  it('falls back to the legacy row', () => {
    expect(pickDatabricksConnection([legacy])).toEqual(legacy)
  })

  it('skips a row without an id', () => {
    const missingId = { id: null, generation: 'new' as const }

    expect(pickDatabricksConnection([missingId, legacy])).toEqual(legacy)
    expect(pickDatabricksConnection([missingId])).toBeUndefined()
  })

  it('skips a row with an invalid generation', () => {
    const invalid = { id: 'invalid-id', generation: null }

    expect(pickDatabricksConnection([invalid, legacy])).toEqual(legacy)
    expect(pickDatabricksConnection([invalid])).toBeUndefined()
  })

  it('returns nothing for an empty list', () => {
    expect(pickDatabricksConnection([])).toBeUndefined()
  })
})

describe('databricksGeneration', () => {
  it('accepts only legacy and new', () => {
    expect(databricksGeneration(created)).toBe('new')
    expect(databricksGeneration(legacy)).toBe('legacy')
    expect(databricksGeneration({ id: 'x', generation: null })).toBeNull()
    expect(databricksGeneration({ id: 'x', generation: 'v3' })).toBeNull()
  })
})

describe('databricksReconnectDropdownConnections', () => {
  it('lists the legacy row and the new row when the stored id is present', () => {
    expect(
      databricksReconnectDropdownConnections([legacy, created], 'legacy-id'),
    ).toEqual([legacy, created])
    expect(
      databricksReconnectDropdownConnections([legacy, created], 'new-id'),
    ).toEqual([legacy, created])
  })

  it('returns one row when the stored id is absent', () => {
    expect(
      databricksReconnectDropdownConnections(
        [legacy, created],
        'transferred-id',
      ),
    ).toEqual([created])
  })
})
