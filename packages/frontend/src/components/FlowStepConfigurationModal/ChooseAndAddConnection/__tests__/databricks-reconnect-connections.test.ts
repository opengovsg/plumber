import { describe, expect, it } from 'vitest'

import {
  databricksReconnectConnections,
  databricksReconnectDropdownConnections,
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
})

describe('databricksReconnectDropdownConnections', () => {
  it('lists the legacy row and the new row while the step is still on the legacy row', () => {
    expect(
      databricksReconnectDropdownConnections([legacy, created], 'legacy-id'),
    ).toEqual([legacy, created])
  })

  it('omits the legacy row once the step is on the new row', () => {
    const missingGeneration = { id: 'old-id' }

    expect(
      databricksReconnectDropdownConnections([legacy, created], 'new-id'),
    ).toEqual([created])
    expect(
      databricksReconnectDropdownConnections(
        [missingGeneration, created],
        'new-id',
      ),
    ).toEqual([created])
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
