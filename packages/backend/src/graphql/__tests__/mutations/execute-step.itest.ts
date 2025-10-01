import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest'

import { ForbiddenError } from '@/errors/graphql-errors'
import { NotFoundError } from '@/errors/graphql-errors/not-found'
import executeStep from '@/graphql/mutations/execute-step'
import User from '@/models/user'
import { TestStepOptions, TestStepResult } from '@/services/test-step'
import Context from '@/types/express/context'

import { generateMockContext } from './tiles/table.mock'
import { generateMockUser } from './flow.mock'

const mockFlowId = '8c2a70d1-e78b-431e-9069-a4d8f97883f6'
const mockStepId = '8c2a70d1-e78b-431e-9069-a4d8f97883f7'

const getMockResolvedValue = (userId: string) => {
  return {
    id: mockStepId,
    key: 'sendTransactionalEmail',
    appKey: 'postman',
    status: 'completed',
    flow: {
      id: mockFlowId,
      userId,
      testExecutionId: null as string | null,
      $query: vi.fn().mockReturnValue({
        patch: vi.fn().mockResolvedValue({}),
      }),
    },
    $query: vi.fn().mockReturnValue({
      patch: vi.fn().mockResolvedValue({}),
    }),
  }
}

vi.mock('@/services/test-step', () => ({
  default: vi.fn(() => {
    return {
      executionStep: {
        id: 'execution-step-1',
        stepId: '8c2a70d1-e78b-431e-9069-a4d8f97883f7',
        isFailed: false,
      },
      executionId: '8c2a70d1-e78b-431e-9069-a4d8f97883f8',
    }
  }),
}))

describe('executeStep mutation - access control', () => {
  let context: Context
  let owner: User
  let editor: User
  let viewer: User
  let nonCollaborator: User
  let testStepSpy: MockInstance<
    (options: TestStepOptions) => Promise<TestStepResult>
  >
  beforeEach(async () => {
    vi.resetAllMocks()

    context = await generateMockContext()
    owner = context.currentUser

    // Create test users
    editor = await generateMockUser('editor')
    viewer = await generateMockUser('viewer')
    nonCollaborator = await generateMockUser('nonCollaborator')

    testStepSpy = vi.spyOn(await import('@/services/test-step'), 'default')
  })

  describe('access control', () => {
    it('should allow owner to execute step successfully', async () => {
      context.currentUser.withAccessibleSteps = vi
        .fn()
        .mockImplementation(({ _type, _requiredRole }) => {
          return {
            withGraphFetched: vi.fn().mockReturnValue({
              findById: vi.fn().mockReturnValue({
                throwIfNotFound: vi
                  .fn()
                  .mockReturnValue(getMockResolvedValue(owner.id)),
              }),
            }),
          }
        })

      const input = {
        stepId: mockStepId,
        testRunMetadata: { testKey: 'testValue' },
      }

      const result = await executeStep(null, { input }, context)

      expect(testStepSpy).toHaveBeenCalledWith({
        stepId: mockStepId,
        testRunMetadata: { testKey: 'testValue' },
      })

      expect(result).toBeDefined()
      expect(result.id).toBe('execution-step-1')
    })

    it('should allow editor to execute step successfully', async () => {
      context.currentUser = editor
      context.currentUser.withAccessibleSteps = vi
        .fn()
        .mockImplementation(({ _type, _requiredRole }) => {
          return {
            withGraphFetched: vi.fn().mockReturnValue({
              findById: vi.fn().mockReturnValue({
                throwIfNotFound: vi
                  .fn()
                  .mockReturnValue(getMockResolvedValue(editor.id)),
              }),
            }),
          }
        })

      const input = {
        stepId: mockStepId,
        testRunMetadata: { testKey: 'testValue' },
      }
      const result = await executeStep(null, { input }, context)

      expect(testStepSpy).toHaveBeenCalledWith({
        stepId: mockStepId,
        testRunMetadata: { testKey: 'testValue' },
      })

      expect(result).toBeDefined()
      expect(result.id).toBe('execution-step-1')
    })

    it('should reject viewer from executing step', async () => {
      context.currentUser = viewer
      context.currentUser.withAccessibleSteps = vi
        .fn()
        .mockImplementation(({ _type, _requiredRole }) => {
          throw new ForbiddenError(
            'You do not have sufficient permissions for this pipe',
          )
        })

      const input = {
        stepId: mockStepId,
        testRunMetadata: { testKey: 'testValue' },
      }

      await expect(executeStep(null, { input }, context)).rejects.toThrow(
        ForbiddenError,
      )
    })

    it('should reject non-collaborator from executing step', async () => {
      context.currentUser = nonCollaborator
      context.currentUser.withAccessibleSteps = vi
        .fn()
        .mockImplementation(({ _type, _requiredRole }) => {
          throw new ForbiddenError(
            'You do not have sufficient permissions for this pipe',
          )
        })

      const input = {
        stepId: mockStepId,
        testRunMetadata: { testKey: 'testValue' },
      }

      await expect(executeStep(null, { input }, context)).rejects.toThrow(
        ForbiddenError,
      )
    })
  })

  it('should require stepId input', async () => {
    const input = {
      testRunMetadata: { testKey: 'testValue' },
    }

    context.currentUser.withAccessibleSteps = vi
      .fn()
      .mockImplementation(({ _type, _requiredRole }) => {
        if (_type === 'step' && _requiredRole === 'editor') {
          return {
            withGraphFetched: vi.fn().mockReturnValue({
              findById: vi.fn().mockReturnValue({
                throwIfNotFound: vi.fn().mockReturnValue({
                  id: mockStepId,
                  key: 'sendTransactionalEmail',
                  appKey: 'postman',
                  status: 'completed',
                  flow: {
                    id: mockFlowId,
                    userId: 'owner-user-id',
                    testExecutionId: null,
                    $query: vi.fn().mockReturnValue({
                      patch: vi.fn().mockResolvedValue({}),
                    }),
                  },
                  $query: vi.fn().mockReturnValue({
                    patch: vi.fn().mockResolvedValue({}),
                  }),
                }),
              }),
            }),
          }
        }
        return {
          withGraphFetched: vi.fn().mockReturnValue({
            findById: vi.fn().mockReturnValue({
              throwIfNotFound: vi.fn().mockReturnValue(null),
            }),
          }),
        }
      })

    await expect(executeStep(null, { input } as any, context)).rejects.toThrow()
  })

  it('should call testStep service with correct parameters', async () => {
    context.currentUser.withAccessibleSteps = vi
      .fn()
      .mockImplementation(({ _type, _requiredRole }) => {
        return {
          withGraphFetched: vi.fn().mockReturnValue({
            findById: vi.fn().mockReturnValue({
              throwIfNotFound: vi.fn().mockReturnValue({
                id: mockStepId,
                key: 'sendTransactionalEmail',
                appKey: 'postman',
                status: 'completed',
                flow: {
                  id: mockFlowId,
                  userId: 'owner-user-id',
                  testExecutionId: null,
                  $query: vi.fn().mockReturnValue({
                    patch: vi.fn().mockResolvedValue({}),
                  }),
                },
                $query: vi.fn().mockReturnValue({
                  patch: vi.fn().mockResolvedValue({}),
                }),
              }),
            }),
          }),
        }
      })

    const input = {
      stepId: mockStepId,
      testRunMetadata: { testKey: 'testValue' },
    }

    await executeStep(null, { input }, context)

    expect(testStepSpy).toHaveBeenCalledWith({
      stepId: mockStepId,
      testRunMetadata: { testKey: 'testValue' },
    })
  })

  it('should throw error when step does not exist', async () => {
    const input = {
      stepId: randomUUID(),
      testRunMetadata: { testKey: 'testValue' },
    }

    context.currentUser.withAccessibleSteps = vi
      .fn()
      .mockImplementation(({ _type, _requiredRole }) => {
        return {
          withGraphFetched: vi.fn().mockReturnValue({
            findById: vi.fn().mockReturnValue({
              throwIfNotFound: vi.fn(() => {
                throw new NotFoundError('Step not found')
              }),
            }),
          }),
        }
      })

    await expect(executeStep(null, { input }, context)).rejects.toThrow(
      NotFoundError,
    )
  })
})
