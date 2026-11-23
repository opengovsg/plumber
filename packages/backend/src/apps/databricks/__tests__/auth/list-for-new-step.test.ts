import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listDatabricksConnectionsForNewStep } from '../../auth/list-for-new-step'

const mocks = vi.hoisted(() => ({
  ensureDatabricksConnection: vi.fn(),
  loadDatabricksConnections: vi.fn(),
}))

vi.mock('../../auth/ensure-new-connection', () => ({
  ensureDatabricksConnection: mocks.ensureDatabricksConnection,
}))

vi.mock('../../auth/get-system-added-connections', () => ({
  default: vi.fn(),
  loadDatabricksConnections: mocks.loadDatabricksConnections,
}))

const ROWS = [
  {
    id: 'bad',
    key: 'databricks',
    verified: true,
    formattedData: { screenName: 'bad_row', generation: 'v3' },
  },
  {
    id: 'legacy',
    key: 'databricks',
    verified: true,
    formattedData: { screenName: 'legacy_row' },
  },
  {
    id: 'new',
    key: 'databricks',
    verified: false,
    formattedData: { screenName: 'new_row', generation: 'new' },
  },
]

describe('listDatabricksConnectionsForNewStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.loadDatabricksConnections.mockResolvedValue(ROWS)
  })

  it('lists only the new row when the gate is on, skipping a bad stored generation', async () => {
    mocks.ensureDatabricksConnection.mockResolvedValue(true)

    const result = await listDatabricksConnectionsForNewStep({} as never)

    expect(result.map((connection) => connection.id)).toEqual(['new'])
  })

  it('lists every row when the gate is off', async () => {
    mocks.ensureDatabricksConnection.mockResolvedValue(false)

    const result = await listDatabricksConnectionsForNewStep({} as never)

    expect(result.map((connection) => connection.id)).toEqual([
      'bad',
      'legacy',
      'new',
    ])
  })
})
