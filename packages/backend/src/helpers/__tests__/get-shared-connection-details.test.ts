import { IStep } from '@plumber/types'

import { describe, expect, it } from 'vitest'

import { getConnectionDetails } from '../get-shared-connection-details'

describe('getConnectionDetails', () => {
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

  it('should not include any metadata for apps without connection fields', () => {
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

    const result = getConnectionDetails(steps)

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

  it('should not include metadata for apps without connection fields', () => {
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

    const result = getConnectionDetails(steps)

    // Should return empty object since paysg has empty APP_CONNECTION_FIELDS
    expect(result).toEqual({
      connection: {
        'paysg-connection-id': {},
      },
      table: [],
    })
  })

  it('should include metadata for apps with parameterKey defined', () => {
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

    const result = getConnectionDetails(steps)

    expect(result).toEqual({
      connection: {
        'slack-connection-id': {},
        'telegram-connection-id': {},
      },
      table: [],
    })
  })

  it('should handle multiple connections with different parameter keys', () => {
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

    const result = getConnectionDetails(steps)

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

  it('should not include duplicate parameter values for the same connection', () => {
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

    const result = getConnectionDetails(steps)

    expect(result).toEqual({
      connection: {
        'slack-connection-id': {},
      },
      table: [],
    })
  })

  it('should handle steps without connectionId', () => {
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

    const result = getConnectionDetails(steps)

    expect(result).toEqual({
      connection: {},
      table: [],
    })
  })

  it('should handle steps with missing parameter values', () => {
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

    const result = getConnectionDetails(steps)

    expect(result).toEqual({
      connection: {
        'slack-connection-id': {},
      },
      table: [],
    })
  })

  describe('special case: Tiles', () => {
    it('should use tableId for tiles app regardless of connectionId', () => {
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

      const result = getConnectionDetails(steps)

      expect(result).toEqual({
        connection: {},
        table: ['table-123', 'table-456'],
      })
    })

    it('should handle tiles step with empty parameters', () => {
      const steps: IStep[] = [
        createMockStep({
          appKey: 'tiles',
          parameters: {},
        }),
      ]

      const result = getConnectionDetails(steps)

      expect(result).toEqual({
        connection: {},
        table: [],
      })
    })

    it('should not include duplicate tableIds for tiles', () => {
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

      const result = getConnectionDetails(steps)

      expect(result).toEqual({
        connection: {},
        table: ['table-123', 'table-456'],
      })
    })
  })

  describe('mixed scenarios', () => {
    it('should handle mix of apps with and without parameterKey defined', () => {
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

      const result = getConnectionDetails(steps)

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

    it('should handle empty steps array', () => {
      const result = getConnectionDetails([])
      expect(result).toEqual({
        connection: {},
        table: [],
      })
    })

    it('should handle steps with unknown appKey', () => {
      const steps: IStep[] = [
        createMockStep({
          appKey: 'unknown-app' as any,
          connectionId: 'unknown-app-connection-id',
          parameters: { someParam: 'value' },
        }),
      ]

      const result = getConnectionDetails(steps)

      // Should return empty object since unknown app is not in APP_CONNECTION_FIELDS
      expect(result).toEqual({
        connection: {
          'unknown-app-connection-id': {},
        },
        table: [],
      })
    })
  })
})
