import { randomUUID } from 'crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/models/app'
import Connection from '@/models/connection'
import User from '@/models/user'

import { listConnectionsService } from '../list-connections'

const mocks = vi.hoisted(() => ({
  getAllLdFlags: vi.fn(),
  getRestrictedAppKeys: vi.fn(),
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getAllLdFlags: mocks.getAllLdFlags,
  getRestrictedAppKeys: mocks.getRestrictedAppKeys,
}))

describe('listConnectionsService', () => {
  beforeEach(() => {
    mocks.getAllLdFlags.mockResolvedValue({})
    mocks.getRestrictedAppKeys.mockReturnValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns connections owned by the user', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `list-conn-owned-${randomUUID()}@example.com`,
    })
    const conn = await Connection.query().insertAndFetch({
      id: randomUUID(),
      key: 'slack',
      userId: user.id,
      verified: true,
      draft: false,
      formattedData: {},
    })

    const result = await listConnectionsService(user)

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: conn.id,
          appKey: 'slack',
          verified: true,
        }),
      ]),
    )
  })

  it('does not return connections belonging to another user', async () => {
    const owner = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `owner-${randomUUID()}@example.com`,
    })
    const other = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `other-${randomUUID()}@example.com`,
    })
    const conn = await Connection.query().insertAndFetch({
      id: randomUUID(),
      key: 'slack',
      userId: owner.id,
      verified: true,
      draft: false,
      formattedData: {},
    })

    const result = await listConnectionsService(other)

    expect(result.map((c) => c.id)).not.toContain(conn.id)
  })

  it('excludes draft connections', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `draft-conn-${randomUUID()}@example.com`,
    })
    const draftConn = await Connection.query().insertAndFetch({
      id: randomUUID(),
      key: 'slack',
      userId: user.id,
      verified: false,
      draft: true,
      formattedData: {},
    })

    const result = await listConnectionsService(user)

    expect(result.map((c) => c.id)).not.toContain(draftConn.id)
  })

  it('falls back to appKey as label when description is absent', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `fallback-label-${randomUUID()}@example.com`,
    })
    const conn = await Connection.query().insertAndFetch({
      id: randomUUID(),
      key: 'postman',
      userId: user.id,
      verified: true,
      draft: false,
      formattedData: {},
    })

    const result = await listConnectionsService(user)
    const found = result.find((c) => c.id === conn.id)

    expect(found?.label).toBe('postman')
  })

  it('filters by appKey when provided', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `filter-appkey-${randomUUID()}@example.com`,
    })
    const slackConn = await Connection.query().insertAndFetch({
      id: randomUUID(),
      key: 'slack',
      userId: user.id,
      verified: true,
      draft: false,
      formattedData: {},
    })
    const postmanConn = await Connection.query().insertAndFetch({
      id: randomUUID(),
      key: 'postman',
      userId: user.id,
      verified: true,
      draft: false,
      formattedData: {},
    })

    const result = await listConnectionsService(user, 'slack')

    expect(result.map((c) => c.id)).toContain(slackConn.id)
    expect(result.map((c) => c.id)).not.toContain(postmanConn.id)
  })

  it('delegates to getSystemAddedConnections for system-added apps', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `system-added-${randomUUID()}@example.com`,
    })
    const mockConn = {
      id: randomUUID(),
      key: 'm365-excel',
      verified: true,
      description: 'Shared Excel connection',
      formattedData: { screenName: 'Excel' },
    }
    const getSystemAddedConnections = vi.fn().mockResolvedValue([mockConn])
    vi.spyOn(App, 'findOneByKey').mockResolvedValueOnce({
      auth: { connectionType: 'system-added', getSystemAddedConnections },
    } as any)

    const result = await listConnectionsService(user, 'm365-excel')

    expect(getSystemAddedConnections).toHaveBeenCalledWith(user)
    expect(result).toEqual([
      {
        id: mockConn.id,
        appKey: 'm365-excel',
        verified: true,
        label: 'Shared Excel connection',
        formattedData: { screenName: 'Excel' },
      },
    ])
  })

  it('includes formattedData on the returned connection', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `formatted-data-${randomUUID()}@example.com`,
    })
    const conn = await Connection.query().insertAndFetch({
      id: randomUUID(),
      key: 'slack',
      userId: user.id,
      verified: true,
      draft: false,
      formattedData: { screenName: 'My Workspace' },
    })

    const result = await listConnectionsService(user)
    const found = result.find((c) => c.id === conn.id)

    expect(found?.formattedData).toEqual({ screenName: 'My Workspace' })
  })
})
