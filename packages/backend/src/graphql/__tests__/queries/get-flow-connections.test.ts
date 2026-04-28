import { describe, expect, it, vi } from 'vitest'

import { ForbiddenError } from '@/errors/graphql-errors'
import getFlowConnections from '@/graphql/queries/get-flow-connections'
import type Context from '@/types/express/context'

vi.mock('@/models/app', () => ({
  default: {
    findAll: vi.fn(() => [
      { key: 'slack', name: 'Slack', iconUrl: 'https://example.com/slack.png' },
      {
        key: 'telegram-bot',
        name: 'Telegram',
        iconUrl: 'https://example.com/telegram.png',
      },
      {
        key: 'tiles',
        name: 'Tables',
        iconUrl: 'https://example.com/tiles.png',
      },
    ]),
  },
}))

const mockFlowConnectionsQuery = vi.fn()

vi.mock('@/models/flow-connections', () => ({
  default: {
    query: () => mockFlowConnectionsQuery(),
  },
}))

const mockFlow = {
  id: 'flow-123',
  role: 'editor',
}

const context = {
  currentUser: {
    withAccessibleFlows: vi.fn().mockReturnValue({
      findById: vi.fn().mockReturnValue(mockFlow),
    }),
  },
} as unknown as Context

describe('getFlowConnections', () => {
  it('should use connection screenName and app key for regular connections', async () => {
    mockFlowConnectionsQuery.mockReturnValue({
      where: vi.fn().mockReturnThis(),
      withGraphFetched: vi.fn().mockResolvedValue([
        {
          flowId: 'flow-123',
          connectionId: 'conn-456',
          connectionType: 'connection',
          connection: {
            key: 'slack',
            formattedData: {
              screenName: 'My Slack Workspace',
            },
          },
          user: { email: 'owner@open.gov.sg' },
        },
      ]),
    })

    const result = await getFlowConnections({}, { flowId: 'flow-123' }, context)

    expect(result).toEqual([
      {
        flowId: 'flow-123',
        connectionId: 'conn-456',
        connectionType: 'connection',
        addedBy: 'owner@open.gov.sg',
        appName: 'Slack',
        appIconUrl: 'https://example.com/slack.png',
        connectionName: 'My Slack Workspace',
      },
    ])
  })

  it('should use table name and "tiles" as appKey for table connections', async () => {
    mockFlowConnectionsQuery.mockReturnValue({
      where: vi.fn().mockReturnThis(),
      withGraphFetched: vi.fn().mockResolvedValue([
        {
          flowId: 'flow-123',
          connectionId: 'table-789',
          connectionType: 'table',
          table: {
            name: 'My Customer Table',
          },
          user: { email: 'owner@open.gov.sg' },
        },
      ]),
    })

    const result = await getFlowConnections({}, { flowId: 'flow-123' }, context)

    expect(result).toEqual([
      {
        flowId: 'flow-123',
        connectionId: 'table-789',
        connectionType: 'table',
        addedBy: 'owner@open.gov.sg',
        appName: 'Tables',
        appIconUrl: 'https://example.com/tiles.png',
        connectionName: 'My Customer Table',
      },
    ])
  })

  it('should handle mixed connection types correctly', async () => {
    mockFlowConnectionsQuery.mockReturnValue({
      where: vi.fn().mockReturnThis(),
      withGraphFetched: vi.fn().mockResolvedValue([
        {
          flowId: 'flow-123',
          connectionId: 'conn-456',
          connectionType: 'connection',
          connection: {
            key: 'telegram-bot',
            formattedData: {
              screenName: 'My Telegram Bot',
            },
          },
          user: {
            email: 'owner@open.gov.sg',
          },
        },
        {
          flowId: 'flow-123',
          connectionId: 'table-789',
          connectionType: 'table',
          table: {
            name: 'Sales Data',
          },
          user: {
            email: 'owner@open.gov.sg',
          },
        },
      ]),
    })

    const result = await getFlowConnections({}, { flowId: 'flow-123' }, context)

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      connectionType: 'connection',
      appName: 'Telegram',
      connectionName: 'My Telegram Bot',
    })
    expect(result[1]).toMatchObject({
      connectionType: 'table',
      appName: 'Tables',
      connectionName: 'Sales Data',
    })
  })

  it('should throw a ForbiddenError if the user does not have access to the flow', async () => {
    context.currentUser.withAccessibleFlows = vi.fn().mockReturnValue({
      findById: vi.fn().mockReturnValue(null),
    })

    await expect(
      getFlowConnections({}, { flowId: 'flow-123' }, context),
    ).rejects.toThrow(ForbiddenError)
  })
})
