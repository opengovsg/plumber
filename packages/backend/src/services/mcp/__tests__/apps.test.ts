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
    // toolbox excluded by default; formsg + slack returned
    expect(apps).toHaveLength(2)
    const formsg = apps.find((a) => a.key === 'formsg')
    expect(formsg?.triggers).toHaveLength(1)
    expect(formsg?.actions).toHaveLength(0)
    const slack = apps.find((a) => a.key === 'slack')
    expect(slack?.triggers).toHaveLength(0)
    expect(slack?.actions).toHaveLength(1)
  })

  it('serializes static dropdown options', async () => {
    const apps = await listAppsService(user)
    const slack = apps.find((a) => a.key === 'slack')
    const channelField = slack?.actions[0].fields.find(
      (f) => f.key === 'channel',
    )
    // dynamic source dropdown — options should be omitted
    expect(channelField?.options).toBeUndefined()
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
