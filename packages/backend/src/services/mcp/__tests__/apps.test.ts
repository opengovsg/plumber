import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listAppsService } from '../apps'

const mocks = vi.hoisted(() => ({
  getAllLdFlags: vi.fn(),
  getRestrictedAppKeys: vi.fn(),
}))

vi.mock('@/apps', () => ({
  default: {
    formsg: {
      key: 'formsg',
      name: 'FormSG',
      triggers: [
        {
          key: 'newSubmission',
          name: 'New Submission',
          description: 'Triggers on new form submission',
          arguments: [
            {
              key: 'formId',
              label: 'Form ID',
              type: 'string',
              required: true,
            },
          ],
        },
      ],
      actions: [],
    },
    slack: {
      key: 'slack',
      name: 'Slack',
      auth: {},
      triggers: [],
      actions: [
        {
          key: 'sendMessage',
          name: 'Send Message',
          description: 'Send a message to a channel',
          arguments: [
            {
              key: 'channel',
              label: 'Channel',
              type: 'dropdown',
              source: { type: 'query' },
            },
            {
              key: 'message',
              label: 'Message',
              type: 'string',
              required: true,
            },
            {
              key: 'noKeySource',
              label: 'No Key Source',
              type: 'dropdown',
              source: {
                type: 'query',
                name: 'getDynamicData',
                arguments: [{ name: 'notKey', value: 'something' }],
              },
            },
          ],
        },
      ],
    },
    tiles: {
      key: 'tiles',
      name: 'Tiles',
      triggers: [],
      actions: [
        {
          key: 'updateSingleRow',
          name: 'Update Single Row',
          description: 'Updates a row in a tile',
          arguments: [
            {
              key: 'tableId',
              label: 'Select Tile',
              type: 'dropdown',
              required: true,
              source: {
                type: 'query',
                name: 'getDynamicData',
                arguments: [{ name: 'key', value: 'listTables' }],
              },
            },
            {
              key: 'rowData',
              label: 'Row data',
              type: 'multirow-multicol',
              required: true,
              subFields: [
                {
                  key: 'columnId',
                  label: 'Column',
                  type: 'dropdown',
                  required: true,
                  source: {
                    type: 'query',
                    name: 'getDynamicData',
                    arguments: [
                      { name: 'key', value: 'listColumns' },
                      {
                        name: 'parameters.tableId',
                        value: '{parameters.tableId}',
                      },
                    ],
                  },
                },
                {
                  key: 'value',
                  label: 'Value',
                  type: 'string',
                  required: true,
                },
              ],
            },
          ],
        },
      ],
    },
    toolbox: {
      key: 'toolbox',
      name: 'Toolbox',
      triggers: [],
      actions: [
        {
          key: 'ifThen',
          name: 'If/Then',
          description: 'Conditional branching',
          arguments: [],
        },
      ],
    },
  },
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getAllLdFlags: mocks.getAllLdFlags,
  getRestrictedAppKeys: mocks.getRestrictedAppKeys,
}))

describe('listAppsService', () => {
  const user = {
    id: '123',
    email: 'test@open.gov.sg',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }

  beforeEach(() => {
    mocks.getAllLdFlags.mockResolvedValue({})
    mocks.getRestrictedAppKeys.mockReturnValue([])
  })

  it('returns visible apps with triggers and actions', async () => {
    const apps = await listAppsService(user)
    // toolbox excluded by default; formsg + slack + tiles returned
    expect(apps).toHaveLength(3)
    const formsg = apps.find((a) => a.key === 'formsg')
    expect(formsg?.triggers).toHaveLength(1)
    expect(formsg?.actions).toHaveLength(0)
    const slack = apps.find((a) => a.key === 'slack')
    expect(slack?.triggers).toHaveLength(0)
    expect(slack?.actions).toHaveLength(1)
  })

  it('sets requiresConnection based on whether app has auth', async () => {
    const apps = await listAppsService(user)
    const slack = apps.find((a) => a.key === 'slack')
    const formsg = apps.find((a) => a.key === 'formsg')
    expect(slack?.requiresConnection).toBe(true)
    expect(formsg?.requiresConnection).toBe(false)
  })

  it('serializes static dropdown options', async () => {
    const apps = await listAppsService(user)
    const slack = apps.find((a) => a.key === 'slack')
    const channelField = slack?.actions[0].fields.find(
      (f) => f.key === 'channel',
    )
    // source with no arguments — not a getDynamicData source, no isDynamic
    expect(channelField?.options).toBeUndefined()
    expect(channelField?.isDynamic).toBeUndefined()
  })

  describe('dynamic dropdown fields', () => {
    it('exposes dynamicDataKey for a dropdown with getDynamicData source (no cascading deps)', async () => {
      const apps = await listAppsService(user)
      const tiles = apps.find((a) => a.key === 'tiles')
      const tableIdField = tiles?.actions[0].fields.find(
        (f) => f.key === 'tableId',
      )
      expect(tableIdField?.isDynamic).toBe(true)
      expect(tableIdField?.dynamicDataKey).toBe('listTables')
      expect(tableIdField?.dynamicDataParameters).toBeUndefined()
      expect(tableIdField?.options).toBeUndefined()
    })

    it('exposes dynamicDataKey and dynamicDataParameters for a cascading dropdown', async () => {
      const apps = await listAppsService(user)
      const tiles = apps.find((a) => a.key === 'tiles')
      const rowDataField = tiles?.actions[0].fields.find(
        (f) => f.key === 'rowData',
      )
      const columnIdField = rowDataField?.subFields?.find(
        (f) => f.key === 'columnId',
      )
      expect(columnIdField?.isDynamic).toBe(true)
      expect(columnIdField?.dynamicDataKey).toBe('listColumns')
      expect(columnIdField?.dynamicDataParameters).toEqual({
        tableId: '{parameters.tableId}',
      })
      expect(columnIdField?.options).toBeUndefined()
    })

    it('serializes subFields on compound fields', async () => {
      const apps = await listAppsService(user)
      const tiles = apps.find((a) => a.key === 'tiles')
      const rowDataField = tiles?.actions[0].fields.find(
        (f) => f.key === 'rowData',
      )
      expect(rowDataField?.subFields).toHaveLength(2)
      const valueField = rowDataField?.subFields?.find((f) => f.key === 'value')
      expect(valueField?.type).toBe('string')
      expect(valueField?.isDynamic).toBeUndefined()
    })

    it('leaves source-less dynamic dropdown without isDynamic (no source.arguments)', async () => {
      const apps = await listAppsService(user)
      const slack = apps.find((a) => a.key === 'slack')
      const channelField = slack?.actions[0].fields.find(
        (f) => f.key === 'channel',
      )
      expect(channelField?.isDynamic).toBeUndefined()
      expect(channelField?.dynamicDataKey).toBeUndefined()
    })

    it('does not set isDynamic when source has arguments but no key argument', async () => {
      const apps = await listAppsService(user)
      const slack = apps.find((a) => a.key === 'slack')
      const field = slack?.actions[0].fields.find(
        (f) => f.key === 'noKeySource',
      )
      expect(field?.isDynamic).toBeUndefined()
      expect(field?.dynamicDataKey).toBeUndefined()
    })
  })

  it('includes required flag on fields', async () => {
    const apps = await listAppsService(user)
    const formsg = apps.find((a) => a.key === 'formsg')
    const formIdField = formsg?.triggers[0].fields.find(
      (f) => f.key === 'formId',
    )
    expect(formIdField?.required).toBe(true)
  })

  describe('LD flag filtering', () => {
    it('excludes app when getRestrictedAppKeys includes it', async () => {
      mocks.getRestrictedAppKeys.mockReturnValue(['formsg'])
      const apps = await listAppsService(user)
      expect(apps.find((a) => a.key === 'formsg')).toBeUndefined()
      expect(apps.find((a) => a.key === 'slack')).toBeDefined()
    })

    it('excludes toolbox by default when app_toolbox flag is absent', async () => {
      const apps = await listAppsService(user)
      expect(apps.find((a) => a.key === 'toolbox')).toBeUndefined()
    })

    it('excludes toolbox when app_toolbox is false', async () => {
      mocks.getAllLdFlags.mockResolvedValue({ app_toolbox: false })
      const apps = await listAppsService(user)
      expect(apps.find((a) => a.key === 'toolbox')).toBeUndefined()
    })

    it('includes toolbox when app_toolbox is true', async () => {
      mocks.getAllLdFlags.mockResolvedValue({ app_toolbox: true })
      const apps = await listAppsService(user)
      expect(apps.find((a) => a.key === 'toolbox')).toBeDefined()
    })

    it('excludes action when app_${appKey}_action_${actionKey} is false', async () => {
      mocks.getAllLdFlags.mockResolvedValue({
        app_slack_action_sendMessage: false,
      })
      const apps = await listAppsService(user)
      const slack = apps.find((a) => a.key === 'slack')
      expect(slack?.actions).toHaveLength(0)
    })

    it('excludes trigger when app_${appKey}_trigger_${triggerKey} is false', async () => {
      mocks.getAllLdFlags.mockResolvedValue({
        app_formsg_trigger_newSubmission: false,
      })
      const apps = await listAppsService(user)
      const formsg = apps.find((a) => a.key === 'formsg')
      expect(formsg?.triggers).toHaveLength(0)
    })
  })
})
