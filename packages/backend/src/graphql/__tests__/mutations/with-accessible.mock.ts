import { vi } from 'vitest'

import User from '@/models/user'

let patchLastUpdatedSpy: ReturnType<typeof vi.fn> | null = null
let assertNotUpdatedSinceSpy: ReturnType<typeof vi.fn> | null = null

export function setPatchLastUpdatedSpy(spy: ReturnType<typeof vi.fn>) {
  patchLastUpdatedSpy = spy
}

export function setAssertNotUpdatedSinceSpy(spy: ReturnType<typeof vi.fn>) {
  assertNotUpdatedSinceSpy = spy
}

const MOCK_STEP_ID = '8c2a70d1-e78b-431e-9069-a4d8f97883f7'
const MOCK_CONNECTION_ID = '8c2a70d1-e78b-431e-9069-a4d8f97883f5'
const MOCK_FLOW_ID = '8c2a70d1-e78b-431e-9069-a4d8f97883f6'
const MOCK_FLOW_UPDATED_AT = '2021-01-01T00:00:00.000Z'

interface MockWithAccessibleStepsOptions {
  owner: User
  currentUser: User
  flowId?: string
  stepId?: string
  stepKey: string
  stepAppKey: string
  stepConnection?: Record<string, any>
  stepStatus?: string
  stepRole?: string
  stepConfig?: Record<string, any>
  stepVersion?: number
  stepNotFound?: boolean
  flowUpdatedAt?: string
}

export function createMockWithAccessibleSteps({
  owner,
  currentUser,
  flowId = MOCK_FLOW_ID,
  stepId = MOCK_STEP_ID,
  stepKey,
  stepAppKey,
  stepConnection = { id: MOCK_CONNECTION_ID, userId: currentUser.id },
  stepStatus = 'completed',
  stepRole = 'owner',
  stepConfig = {},
  stepVersion,
  stepNotFound = false,
  flowUpdatedAt = MOCK_FLOW_UPDATED_AT,
}: MockWithAccessibleStepsOptions) {
  return vi
    .fn()
    .mockImplementation(
      (_args?: { queryBuilder?: any; requiredRole?: string; trx?: any }) => {
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
            version: stepVersion,
            connection: stepAppKey === 'tiles' ? {} : stepConnection,
            config: stepConfig,
            flow: {
              userId: owner.id,
              updatedAt: flowUpdatedAt,
              role: stepRole,
              assertNotUpdatedSince:
                assertNotUpdatedSinceSpy || vi.fn().mockResolvedValue({}),
              patchLastUpdated:
                patchLastUpdatedSpy || vi.fn().mockResolvedValue({}),
            },
          }),
        }
      },
    )
}
