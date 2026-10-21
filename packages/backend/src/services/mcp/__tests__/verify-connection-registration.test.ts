import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FORMSG_WEBHOOK_VERIFICATION_MESSAGE } from '@/apps/formsg/common/webhook-settings'

import { verifyConnectionRegistrationService } from '../verify-connection-registration'

const mocks = vi.hoisted(() => ({
  verifyConnectionRegistration: vi.fn(),
  flowFindById: vi.fn(),
}))

vi.mock('@/apps', () => ({
  default: {
    formsg: {
      key: 'formsg',
      auth: {
        connectionRegistrationType: 'per-step' as const,
        verifyConnectionRegistration: mocks.verifyConnectionRegistration,
      },
    },
  },
}))

vi.mock('@/helpers/global-variable', () => ({
  default: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/models/flow', () => ({
  default: {
    query: vi.fn().mockReturnValue({
      findById: mocks.flowFindById,
    }),
  },
}))

const makeUser = () =>
  ({
    id: 'user-1',
    email: 'test@example.com',
    withAccessibleSteps: vi.fn().mockReturnValue({
      findOne: vi.fn().mockResolvedValue({
        id: 'step-1',
        appKey: 'formsg',
        flowId: 'flow-1',
      }),
    }),
    withAccessibleConnections: vi.fn().mockReturnValue({
      findOne: vi
        .fn()
        .mockResolvedValue({ id: 'conn-1', key: 'formsg', userId: 'user-1' }),
    }),
  } as any)

describe('verifyConnectionRegistrationService', () => {
  let user: ReturnType<typeof makeUser>

  beforeEach(() => {
    vi.clearAllMocks()
    user = makeUser()
    mocks.flowFindById.mockResolvedValue({ id: 'flow-1', name: 'Test' })
  })

  it('returns VERIFIED when registrationVerified is true', async () => {
    mocks.verifyConnectionRegistration.mockResolvedValue({
      registrationVerified: true,
      message: FORMSG_WEBHOOK_VERIFICATION_MESSAGE.VERIFIED,
    })

    const result = await verifyConnectionRegistrationService(
      user,
      'step-1',
      'conn-1',
    )

    expect(result.status).toBe('VERIFIED')
  })

  it('returns ANOTHER_ENDPOINT when message matches that constant', async () => {
    mocks.verifyConnectionRegistration.mockResolvedValue({
      registrationVerified: false,
      message: FORMSG_WEBHOOK_VERIFICATION_MESSAGE.ANOTHER_ENDPOINT,
    })

    const result = await verifyConnectionRegistrationService(
      user,
      'step-1',
      'conn-1',
    )

    expect(result.status).toBe('ANOTHER_ENDPOINT')
    expect(result.message).toBe(
      FORMSG_WEBHOOK_VERIFICATION_MESSAGE.ANOTHER_ENDPOINT,
    )
  })

  it('returns ANOTHER_PIPE when message matches that constant', async () => {
    mocks.verifyConnectionRegistration.mockResolvedValue({
      registrationVerified: false,
      message: FORMSG_WEBHOOK_VERIFICATION_MESSAGE.ANOTHER_PIPE,
    })

    const result = await verifyConnectionRegistrationService(
      user,
      'step-1',
      'conn-1',
    )

    expect(result.status).toBe('ANOTHER_PIPE')
    expect(result.message).toBe(
      FORMSG_WEBHOOK_VERIFICATION_MESSAGE.ANOTHER_PIPE,
    )
  })

  it('returns UNREGISTERED when registrationVerified is false and message is undefined', async () => {
    mocks.verifyConnectionRegistration.mockResolvedValue({
      registrationVerified: false,
    })

    const result = await verifyConnectionRegistrationService(
      user,
      'step-1',
      'conn-1',
    )

    expect(result.status).toBe('UNREGISTERED')
  })

  it('throws when message is an auth/network error (UNAUTHORIZED)', async () => {
    mocks.verifyConnectionRegistration.mockResolvedValue({
      registrationVerified: false,
      message: FORMSG_WEBHOOK_VERIFICATION_MESSAGE.UNAUTHORIZED,
    })

    await expect(
      verifyConnectionRegistrationService(user, 'step-1', 'conn-1'),
    ).rejects.toThrow(FORMSG_WEBHOOK_VERIFICATION_MESSAGE.UNAUTHORIZED)
  })

  describe('guard branches', () => {
    it('throws when step is not found', async () => {
      user.withAccessibleSteps.mockReturnValue({
        findOne: vi.fn().mockResolvedValue(null),
      })

      await expect(
        verifyConnectionRegistrationService(user, 'step-1', 'conn-1'),
      ).rejects.toThrow('Step not found')
    })

    it('throws when connection is not found', async () => {
      user.withAccessibleConnections.mockReturnValue({
        findOne: vi.fn().mockResolvedValue(null),
      })

      await expect(
        verifyConnectionRegistrationService(user, 'step-1', 'conn-1'),
      ).rejects.toThrow('Connection not found')
    })

    it('throws when connection belongs to another user', async () => {
      user.withAccessibleConnections.mockReturnValue({
        findOne: vi.fn().mockResolvedValue({
          id: 'conn-1',
          key: 'formsg',
          userId: 'other-user',
        }),
      })

      await expect(
        verifyConnectionRegistrationService(user, 'step-1', 'conn-1'),
      ).rejects.toThrow(
        'You cannot use a personal connection that you do not own',
      )
    })

    it('throws when connection app does not match step app', async () => {
      user.withAccessibleConnections.mockReturnValue({
        findOne: vi
          .fn()
          .mockResolvedValue({ id: 'conn-1', key: 'slack', userId: 'user-1' }),
      })

      await expect(
        verifyConnectionRegistrationService(user, 'step-1', 'conn-1'),
      ).rejects.toThrow('Connection app does not match step app')
    })

    it('throws when app does not support connection registration verification', async () => {
      // Use an appKey not present in the mocked apps registry
      user.withAccessibleSteps.mockReturnValue({
        findOne: vi.fn().mockResolvedValue({
          id: 'step-1',
          appKey: 'slack',
          flowId: 'flow-1',
        }),
      })
      user.withAccessibleConnections.mockReturnValue({
        findOne: vi
          .fn()
          .mockResolvedValue({ id: 'conn-1', key: 'slack', userId: 'user-1' }),
      })

      await expect(
        verifyConnectionRegistrationService(user, 'step-1', 'conn-1'),
      ).rejects.toThrow(
        'App does not support connection registration verification',
      )
    })

    it('throws when flow is not found', async () => {
      mocks.flowFindById.mockResolvedValue(null)

      await expect(
        verifyConnectionRegistrationService(user, 'step-1', 'conn-1'),
      ).rejects.toThrow('Flow not found')
    })
  })
})
