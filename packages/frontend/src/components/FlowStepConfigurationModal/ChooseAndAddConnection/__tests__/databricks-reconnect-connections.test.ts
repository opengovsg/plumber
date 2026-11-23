import { describe, expect, it } from 'vitest'

import {
  databricksGeneration,
  databricksReconnectConnections,
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
    const missingGeneration = { id: 'legacy-id' }

    expect(
      databricksReconnectConnections([missingGeneration], 'transferred-id'),
    ).toEqual([missingGeneration])
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

  it('returns nothing for an empty list', () => {
    expect(pickDatabricksConnection([])).toBeUndefined()
  })
})

describe('databricksGeneration', () => {
  it('treats anything but new as legacy', () => {
    expect(databricksGeneration(created)).toBe('new')
    expect(databricksGeneration(legacy)).toBe('legacy')
    expect(databricksGeneration({ id: 'x' })).toBe('legacy')
    expect(databricksGeneration({ id: 'x', generation: null })).toBe('legacy')
  })
})
