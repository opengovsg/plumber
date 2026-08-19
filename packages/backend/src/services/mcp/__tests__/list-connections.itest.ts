import { randomUUID } from 'crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/models/app'
import Connection from '@/models/connection'
import User from '@/models/user'

import { listConnectionsService } from '../list-connections'

const mocks = vi.hoisted(() => ({
  getAllLdFlags: vi.fn(),
  getRestrictedAppKeys: vi.fn(),
  checkLiveMrfStatus: vi.fn(),
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getAllLdFlags: mocks.getAllLdFlags,
  getRestrictedAppKeys: mocks.getRestrictedAppKeys,
}))

vi.mock('@/apps/formsg/common/check-live-mrf-status', () => ({
  checkLiveMrfStatus: mocks.checkLiveMrfStatus,
}))

describe('listConnectionsService', () => {
  beforeEach(() => {
    mocks.getAllLdFlags.mockResolvedValue({})
    mocks.getRestrictedAppKeys.mockReturnValue([])
    mocks.checkLiveMrfStatus.mockReset()
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
        label: 'Excel',
      },
    ])
  })

  // formattedData holds the connection's decrypted credentials (it's used
  // downstream as $.auth.data — see helpers/global-variable.ts), so it must
  // never be exposed via the MCP tool surface, which is read by the LLM.
  it('does not include formattedData in the returned connection', async () => {
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
      formattedData: {
        screenName: 'My Workspace',
        accessToken: 'secret-token',
      },
    })

    const result = await listConnectionsService(user)
    const found = result.find((c) => c.id === conn.id)

    expect(found?.label).toBe('My Workspace')
    expect(found).not.toHaveProperty('formattedData')
  })

  describe('stale [MRF] label correction (PLU-866)', () => {
    const insertFormsgConn = async (userId: string, screenName: string) =>
      Connection.query().insertAndFetch({
        id: randomUUID(),
        key: 'formsg',
        userId,
        verified: true,
        draft: false,
        formattedData: {
          screenName,
          formId: 'https://form.gov.sg/654ab1234abc1a012345f1e0',
        },
      })

    it('strips the stale tag once a live check confirms the form is no longer MRF', async () => {
      mocks.checkLiveMrfStatus.mockResolvedValue(false)
      const user = await User.query().insertAndFetch({
        id: randomUUID(),
        email: `mrf-stale-${randomUUID()}@example.com`,
      })
      const conn = await insertFormsgConn(
        user.id,
        '[MRF] 654ab1234abc1a012345f1e0 - Old Form',
      )

      const result = await listConnectionsService(user, 'formsg')

      expect(result.find((c) => c.id === conn.id)?.label).toBe(
        '654ab1234abc1a012345f1e0 - Old Form',
      )
    })

    it('keeps the env prefix while stripping only the MRF tag', async () => {
      mocks.checkLiveMrfStatus.mockResolvedValue(false)
      const user = await User.query().insertAndFetch({
        id: randomUUID(),
        email: `mrf-stale-env-${randomUUID()}@example.com`,
      })
      const conn = await insertFormsgConn(
        user.id,
        '[STAGING] [MRF] 654ab1234abc1a012345f1e0 - Old Form',
      )

      const result = await listConnectionsService(user, 'formsg')

      expect(result.find((c) => c.id === conn.id)?.label).toBe(
        '[STAGING] 654ab1234abc1a012345f1e0 - Old Form',
      )
    })

    it('keeps the tag when the live check confirms the form is still MRF', async () => {
      mocks.checkLiveMrfStatus.mockResolvedValue(true)
      const user = await User.query().insertAndFetch({
        id: randomUUID(),
        email: `mrf-still-${randomUUID()}@example.com`,
      })
      const conn = await insertFormsgConn(
        user.id,
        '[MRF] 654ab1234abc1a012345f1e0 - Real MRF Form',
      )

      const result = await listConnectionsService(user, 'formsg')

      expect(result.find((c) => c.id === conn.id)?.label).toBe(
        '[MRF] 654ab1234abc1a012345f1e0 - Real MRF Form',
      )
    })

    it('keeps the tag when the live check fails (fail safe)', async () => {
      mocks.checkLiveMrfStatus.mockResolvedValue(null)
      const user = await User.query().insertAndFetch({
        id: randomUUID(),
        email: `mrf-unknown-${randomUUID()}@example.com`,
      })
      const conn = await insertFormsgConn(
        user.id,
        '[MRF] 654ab1234abc1a012345f1e0 - Unreachable Form',
      )

      const result = await listConnectionsService(user, 'formsg')

      expect(result.find((c) => c.id === conn.id)?.label).toBe(
        '[MRF] 654ab1234abc1a012345f1e0 - Unreachable Form',
      )
    })

    it('does not perform a live check for a label with no stale tag', async () => {
      const user = await User.query().insertAndFetch({
        id: randomUUID(),
        email: `mrf-no-tag-${randomUUID()}@example.com`,
      })
      await insertFormsgConn(user.id, '654ab1234abc1a012345f1e0 - Plain Form')

      await listConnectionsService(user, 'formsg')

      expect(mocks.checkLiveMrfStatus).not.toHaveBeenCalled()
    })

    it('does not perform a live check for non-FormSG connections', async () => {
      const user = await User.query().insertAndFetch({
        id: randomUUID(),
        email: `mrf-other-app-${randomUUID()}@example.com`,
      })
      await Connection.query().insertAndFetch({
        id: randomUUID(),
        key: 'slack',
        userId: user.id,
        verified: true,
        draft: false,
        formattedData: { screenName: '[MRF] some workspace' },
      })

      await listConnectionsService(user, 'slack')

      expect(mocks.checkLiveMrfStatus).not.toHaveBeenCalled()
    })

    // Connection labels are user-controlled (updateConnection lets a user
    // patch formattedData.screenName/formId on any connection they own), so a
    // user can cheaply create many formsg connections tagged with a stale
    // "[MRF] " label. Without a concurrency cap, listing them would fan out
    // one concurrent outbound request per connection to FormSG's public API
    // (self-DoS / shared-egress-IP-ban risk) — see hacktron finding
    // e7ce2d1f-ca60-4640-ad3a-724646a7bebc.
    it('caps concurrent live MRF checks when many connections are stale-tagged', async () => {
      let inFlight = 0
      let maxInFlight = 0
      mocks.checkLiveMrfStatus.mockImplementation(async () => {
        inFlight++
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise((resolve) => setTimeout(resolve, 20))
        inFlight--
        return false
      })

      const user = await User.query().insertAndFetch({
        id: randomUUID(),
        email: `mrf-concurrency-${randomUUID()}@example.com`,
      })
      const CONNECTION_COUNT = 12
      await Promise.all(
        Array.from({ length: CONNECTION_COUNT }, (_, i) =>
          insertFormsgConn(user.id, `[MRF] form-${i} - Old Form ${i}`),
        ),
      )

      await listConnectionsService(user, 'formsg')

      expect(mocks.checkLiveMrfStatus).toHaveBeenCalledTimes(CONNECTION_COUNT)
      // Sanity check that the test actually exercised overlapping calls,
      // otherwise the upper-bound assertion below would pass trivially.
      expect(maxInFlight).toBeGreaterThan(1)
      expect(maxInFlight).toBeLessThanOrEqual(5)
    })
  })
})
