import { describe, expect, it } from 'vitest'

import {
  databricksReconnectConnections,
  databricksReconnectDropdownConnections,
} from './databricks-reconnect-connections'

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
