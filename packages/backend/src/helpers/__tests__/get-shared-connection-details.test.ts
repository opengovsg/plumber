import { IStep } from '@plumber/types'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/models/app'
import Connection from '@/models/connection'
import TableMetadata from '@/models/table-metadata'

import { getConnectionDetails } from '../get-shared-connection-details'

vi.mock('@/models/app')
vi.mock('@/models/connection')
vi.mock('@/models/table-metadata')

describe('getConnectionDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock: all apps have connections (matches pre-existing behavior)
    vi.mocked(App.getAllAppsWithConnections).mockResolvedValue([
      { key: 'aisay', auth: {} },
      { key: 'custom-api', auth: {} },
      { key: 'formsg', auth: {} },
      { key: 'slack', auth: {} },
      { key: 'lettersg', auth: {} },
      { key: 'm365-excel', auth: {} },
      { key: 'paysg', auth: {} },
      { key: 'postman-sms', auth: {} },
      { key: 'slack', auth: {} },
      { key: 'telegram-bot', auth: {} },
    ] as any)

    // Default mock: all connections exist (optimistic path)
    vi.mocked(Connection.query).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      whereIn: vi.fn().mockImplementation((_, ids) => {
        // Return all requested IDs as existing
        return Promise.resolve(ids.map((id: string) => ({ id })))
      }),
    } as any)

    // Default mock: all tables exist (optimistic path)
    vi.mocked(TableMetadata.query).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      whereIn: vi.fn().mockImplementation((_, ids) => {
        // Return all requested IDs as existing
        return Promise.resolve(ids.map((id: string) => ({ id })))
      }),
    } as any)
  })

  const createMockStep = (overrides: Partial<IStep> = {}): IStep => ({
    id: 'step-1',
    flowId: 'flow-1',
    appKey: 'slack',
    type: 'action',
    connectionId: null,
    status: 'completed',
    position: 1,
    parameters: {},
    connection: undefined,
    flow: {} as any,
    executionSteps: [],
    config: {},
    iconUrl: 'https://example.com/icon.svg',
    webhookUrl: 'https://example.com/webhook',
    createdAt: '2023-01-01T00:00:00Z',
    ...overrides,
  })

  it('should not include any metadata for apps without connection fields', async () => {
    const steps: IStep[] = [
      createMockStep({
        appKey: 'aisay',
        connectionId: 'aisay-connection-id',
        parameters: { someParam: 'value' },
      }),
      createMockStep({
        appKey: 'custom-api',
        connectionId: 'custom-api-connection-id',
        parameters: { anotherParam: 'value2' },
      }),
      createMockStep({
        appKey: 'formsg',
        connectionId: 'formsg-connection-id',
        parameters: { formParam: 'value3' },
      }),
    ]

    const result = await getConnectionDetails(steps)

    // Should return empty object since none of these apps have parameterKey defined
    expect(result).toEqual({
      connection: {
        'aisay-connection-id': {},
        'custom-api-connection-id': {},
        'formsg-connection-id': {},
      },
      table: [],
    })
  })

  it('should not include metadata for apps without connection fields', async () => {
    const steps: IStep[] = [
      createMockStep({
        appKey: 'paysg',
        connectionId: 'paysg-connection-id',
        parameters: {
          fileId: 'file-123',
          channel: 'general',
          templateId: 'template-456',
        },
      }),
    ]

    const result = await getConnectionDetails(steps)

    // Should return empty object since paysg has empty APP_CONNECTION_FIELDS
    expect(result).toEqual({
      connection: {
        'paysg-connection-id': {},
      },
      table: [],
    })
  })

  it('should include metadata for apps with parameterKey defined', async () => {
    const steps: IStep[] = [
      createMockStep({
        appKey: 'slack',
        connectionId: 'slack-connection-id',
        parameters: { channel: 'general' },
      }),
      createMockStep({
        appKey: 'telegram-bot',
        connectionId: 'telegram-connection-id',
        parameters: { chatId: 'random' },
      }),
    ]

    const result = await getConnectionDetails(steps)

    expect(result).toEqual({
      connection: {
        'slack-connection-id': {},
        'telegram-connection-id': {},
      },
      table: [],
    })
  })

  it('should handle multiple connections with different parameter keys', async () => {
    const steps: IStep[] = [
      createMockStep({
        appKey: 'slack',
        connectionId: 'slack-connection-id',
        parameters: { channel: 'general' },
      }),
      createMockStep({
        appKey: 'm365-excel',
        connectionId: 'm365-excel-connection-id',
        parameters: { fileId: 'file-123' },
      }),
      createMockStep({
        appKey: 'lettersg',
        connectionId: 'lettersg-connection-id',
        parameters: { templateId: 'template-456' },
      }),
    ]

    const result = await getConnectionDetails(steps)

    expect(result).toEqual({
      connection: {
        'slack-connection-id': {},
        'm365-excel-connection-id': {
          fileId: ['file-123'],
        },
        'lettersg-connection-id': {},
      },
      table: [],
    })
  })

  it('should not include duplicate parameter values for the same connection', async () => {
    const steps: IStep[] = [
      createMockStep({
        appKey: 'slack',
        connectionId: 'slack-connection-id',
        parameters: { channel: 'general' },
      }),
      createMockStep({
        appKey: 'slack',
        connectionId: 'slack-connection-id',
        parameters: { channel: 'general' }, // duplicate
      }),
      createMockStep({
        appKey: 'slack',
        connectionId: 'slack-connection-id',
        parameters: { channel: 'random' },
      }),
    ]

    const result = await getConnectionDetails(steps)

    expect(result).toEqual({
      connection: {
        'slack-connection-id': {},
      },
      table: [],
    })
  })

  it('should handle steps without connectionId', async () => {
    const steps: IStep[] = [
      createMockStep({
        appKey: 'formatter',
        connectionId: undefined,
        parameters: { channel: 'general' },
      }),
      createMockStep({
        appKey: 'custom-api',
        connectionId: null,
        parameters: { channel: 'random' },
      }),
    ]

    const result = await getConnectionDetails(steps)

    expect(result).toEqual({
      connection: {},
      table: [],
    })
  })

  it('should handle steps with missing parameter values', async () => {
    const steps: IStep[] = [
      createMockStep({
        appKey: 'slack',
        connectionId: 'slack-connection-id',
        parameters: { channel: undefined },
      }),
      createMockStep({
        appKey: 'slack',
        connectionId: 'slack-connection-id',
        parameters: { channel: '' },
      }),
    ]

    const result = await getConnectionDetails(steps)

    expect(result).toEqual({
      connection: {
        'slack-connection-id': {},
      },
      table: [],
    })
  })

  describe('special case: Tiles', () => {
    it('should use tableId for tiles app regardless of connectionId', async () => {
      const steps: IStep[] = [
        createMockStep({
          appKey: 'tiles',
          parameters: { tableId: 'table-123' },
        }),
        createMockStep({
          appKey: 'tiles',
          parameters: { tableId: 'table-456' },
        }),
      ]

      const result = await getConnectionDetails(steps)

      expect(result).toEqual({
        connection: {},
        table: ['table-123', 'table-456'],
      })
    })

    it('should handle tiles step with empty parameters', async () => {
      const steps: IStep[] = [
        createMockStep({
          appKey: 'tiles',
          parameters: {},
        }),
      ]

      const result = await getConnectionDetails(steps)

      expect(result).toEqual({
        connection: {},
        table: [],
      })
    })

    it('should not include duplicate tableIds for tiles', async () => {
      const steps: IStep[] = [
        createMockStep({
          appKey: 'tiles',
          connectionId: null,
          parameters: { tableId: 'table-123' },
        }),
        createMockStep({
          appKey: 'tiles',
          connectionId: null,
          parameters: { tableId: 'table-123' }, // duplicate
        }),
        createMockStep({
          appKey: 'tiles',
          connectionId: null,
          parameters: { tableId: 'table-456' },
        }),
      ]

      const result = await getConnectionDetails(steps)

      expect(result).toEqual({
        connection: {},
        table: ['table-123', 'table-456'],
      })
    })

    it('should not include connection ids for Tiles steps', async () => {
      const steps: IStep[] = [
        createMockStep({
          appKey: 'tiles',
          connectionId: 'tiles-connection-id',
          parameters: { tableId: 'table-123' },
        }),
        createMockStep({
          appKey: 'tiles',
          parameters: { tableId: 'table-456' },
        }),
      ]

      const result = await getConnectionDetails(steps)

      expect(result).toEqual({
        connection: {},
        table: ['table-123', 'table-456'],
      })
    })
  })

  describe('mixed scenarios', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should filter out deleted connections', async () => {
      const steps: IStep[] = [
        createMockStep({
          appKey: 'slack',
          connectionId: 'existing-connection-id',
          parameters: { channel: 'general' },
        }),
        createMockStep({
          appKey: 'slack',
          connectionId: 'deleted-connection-id',
          parameters: { channel: 'random' },
        }),
        createMockStep({
          appKey: 'm365-excel',
          connectionId: 'deleted-excel-connection-id',
          parameters: { fileId: 'file-123' },
        }),
      ]

      // Mock Connection.query to return only the existing connection
      vi.mocked(Connection.query).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        whereIn: vi.fn().mockResolvedValue([
          { id: 'existing-connection-id' },
          // deleted-connection-id is not returned
          // deleted-excel-connection-id is not returned
        ]),
      } as any)

      const result = await getConnectionDetails(steps)

      // Should only include the existing connection
      expect(result).toEqual({
        connection: {
          'existing-connection-id': {},
        },
        table: [],
      })

      // Verify that Connection.query was called with the correct connection IDs
      expect(Connection.query).toHaveBeenCalled()
    })

    it('should filter out deleted tables', async () => {
      const steps: IStep[] = [
        createMockStep({
          appKey: 'tiles',
          parameters: { tableId: 'existing-table-id' },
        }),
        createMockStep({
          appKey: 'tiles',
          parameters: { tableId: 'deleted-table-id' },
        }),
        createMockStep({
          appKey: 'tiles',
          parameters: { tableId: 'another-deleted-table-id' },
        }),
      ]

      // Mock TableMetadata.query to return only the existing table
      vi.mocked(TableMetadata.query).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        whereIn: vi.fn().mockResolvedValue([
          { id: 'existing-table-id' },
          // deleted-table-id is not returned
          // another-deleted-table-id is not returned
        ]),
      } as any)

      const result = await getConnectionDetails(steps)

      // Should only include the existing table
      expect(result).toEqual({
        connection: {},
        table: ['existing-table-id'],
      })

      // Verify that TableMetadata.query was called
      expect(TableMetadata.query).toHaveBeenCalled()
    })

    it('should filter out both deleted connections and deleted tables', async () => {
      const steps: IStep[] = [
        createMockStep({
          appKey: 'slack',
          connectionId: 'existing-connection-id',
          parameters: { channel: 'general' },
        }),
        createMockStep({
          appKey: 'slack',
          connectionId: 'deleted-connection-id',
          parameters: { channel: 'random' },
        }),
        createMockStep({
          appKey: 'tiles',
          parameters: { tableId: 'existing-table-id' },
        }),
        createMockStep({
          appKey: 'tiles',
          parameters: { tableId: 'deleted-table-id' },
        }),
      ]

      // Mock Connection.query to return only the existing connection
      vi.mocked(Connection.query).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        whereIn: vi.fn().mockResolvedValue([{ id: 'existing-connection-id' }]),
      } as any)

      // Mock TableMetadata.query to return only the existing table
      vi.mocked(TableMetadata.query).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        whereIn: vi.fn().mockResolvedValue([{ id: 'existing-table-id' }]),
      } as any)

      const result = await getConnectionDetails(steps)

      // Should only include the existing connection and table
      expect(result).toEqual({
        connection: {
          'existing-connection-id': {},
        },
        table: ['existing-table-id'],
      })

      // Verify that both queries were called
      expect(Connection.query).toHaveBeenCalled()
      expect(TableMetadata.query).toHaveBeenCalled()
    })

    it('should handle mix of apps with and without parameterKey defined', async () => {
      const steps: IStep[] = [
        // Apps with empty APP_CONNECTION_FIELDS
        createMockStep({
          appKey: 'aisay',
          connectionId: 'aisay-connection-id',
          parameters: { someParam: 'value' },
        }),
        createMockStep({
          appKey: 'custom-api',
          connectionId: 'custom-api-connection-id',
          parameters: { anotherParam: 'value2' },
        }),
        // Apps with parameterKey defined
        createMockStep({
          appKey: 'slack',
          connectionId: 'slack-connection-id',
          parameters: { channel: 'general' },
        }),
        createMockStep({
          appKey: 'm365-excel',
          connectionId: 'm365-excel-connection-id',
          parameters: { fileId: 'file-123' },
        }),
        // Tiles app
        createMockStep({
          appKey: 'tiles',
          parameters: { tableId: 'table-123' },
        }),
      ]

      const result = await getConnectionDetails(steps)

      expect(result).toEqual({
        connection: {
          'aisay-connection-id': {},
          'custom-api-connection-id': {},
          'slack-connection-id': {},
          'm365-excel-connection-id': {
            fileId: ['file-123'],
          },
        },
        table: ['table-123'],
      })
    })

    it('should handle empty steps array', async () => {
      const result = await getConnectionDetails([])
      expect(result).toEqual({
        connection: {},
        table: [],
      })
    })

    it('should handle steps with unknown appKey', async () => {
      const steps: IStep[] = [
        createMockStep({
          appKey: 'unknown-app' as any,
          connectionId: 'unknown-app-connection-id',
          parameters: { someParam: 'value' },
        }),
      ]

      const result = await getConnectionDetails(steps)

      // Should return empty object since unknown app is not a valid app
      expect(result).toEqual({
        connection: {},
        table: [],
      })
    })
  })
})
