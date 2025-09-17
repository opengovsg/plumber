import { vi } from 'vitest'

import User from '@/models/user'

let patchFlowLastUpdatedSpy: ReturnType<typeof vi.fn> | null = null

export function setPatchFlowLastUpdatedSpy(spy: ReturnType<typeof vi.fn>) {
  patchFlowLastUpdatedSpy = spy
}

interface MockWithAccessibleOptions {
  owner: User
  currentUser: User
  stepKey: string
  stepAppKey: string
  connectionKey: string
  stepId?: string
  connectionId?: string
  stepStatus?: string
  stepRole?: string
  flowId?: string
  stepConfig?: Record<string, any>
  stepConnection?: Record<string, any>
  stepNotFound?: boolean
  connectionNotFound?: boolean
  flowUpdatedAt?: string
}

const MOCK_STEP_ID = '8c2a70d1-e78b-431e-9069-a4d8f97883f7'
const MOCK_CONNECTION_ID = '8c2a70d1-e78b-431e-9069-a4d8f97883f5'
const MOCK_FLOW_ID = '8c2a70d1-e78b-431e-9069-a4d8f97883f6'
const MOCK_FLOW_UPDATED_AT = '2021-01-01T00:00:00.000Z'

/**
 * Creates a reusable mock for context.currentUser.withAccessible
 * @param options Configuration for the mock
 * @returns Mock function for withAccessible
 */
export function createMockWithAccessible({
  owner,
  currentUser,
  stepKey,
  stepAppKey,
  connectionKey,
  stepId = MOCK_STEP_ID,
  connectionId = MOCK_CONNECTION_ID,
  stepStatus = 'completed',
  stepRole = 'owner',
  flowId = MOCK_FLOW_ID,
  stepConfig = {},
  stepConnection = { id: connectionId, userId: currentUser.id },
  stepNotFound = false,
  connectionNotFound = false,
  flowUpdatedAt = MOCK_FLOW_UPDATED_AT,
}: MockWithAccessibleOptions) {
  return vi.fn().mockImplementation(({ type, _requiredRole }) => {
    if (type === 'step') {
      if (stepNotFound) {
        return {
          withGraphFetched: vi.fn().mockReturnThis(),
          findOne: vi.fn().mockResolvedValue(null),
        }
      }

      return {
        withGraphFetched: vi.fn().mockReturnThis(),
        findOne: vi.fn().mockResolvedValue({
          id: stepId,
          key: stepKey,
          appKey: stepAppKey,
          status: stepStatus,
          role: stepRole,
          flowId,
          connection: stepAppKey === 'tiles' ? {} : stepConnection,
          config: stepConfig,
          flow: {
            userId: owner.id,
            updatedAt: flowUpdatedAt,
          },
          patchFlowLastUpdated:
            patchFlowLastUpdatedSpy || vi.fn().mockResolvedValue({}),
        }),
      }
    }

    if (type === 'connection') {
      if (connectionNotFound) {
        return {
          findOne: vi.fn().mockResolvedValue(null),
        }
      }

      return {
        findOne: vi.fn().mockResolvedValue({
          id: connectionId,
          key: connectionKey,
        }),
      }
    }

    return {
      findOne: vi.fn().mockResolvedValue(null),
    }
  })
}
