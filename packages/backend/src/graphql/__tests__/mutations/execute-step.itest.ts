import { randomUUID } from 'crypto'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  MockInstance,
  vi,
} from 'vitest'

import { ForbiddenError } from '@/errors/graphql-errors'
import { NotFoundError } from '@/errors/graphql-errors/not-found'
import executeStep from '@/graphql/mutations/execute-step'
import Execution from '@/models/execution'
import Flow from '@/models/flow'
import Step from '@/models/step'
import User from '@/models/user'
import { TestStepOptions, TestStepResult } from '@/services/test-step'
import * as testStepModule from '@/services/test-step.js'
import Context from '@/types/express/context'

import { generateMockUser } from './flow.mock'
import { generateMockContext } from './tiles/table.mock'

const mockFlowId = '8c2a70d1-e78b-431e-9069-a4d8f97883f6'
const mockStepId = '8c2a70d1-e78b-431e-9069-a4d8f97883f7'

const getMockResolvedValue = (userId: string) => {
  return {
    id: mockStepId,
    key: 'sendTransactionalEmail',
    appKey: 'postman',
    status: 'completed',
    flowId: mockFlowId,
    parameters: {},
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
      patchAndFetch: vi.fn().mockResolvedValue({
        id: mockStepId,
        key: 'sendTransactionalEmail',
        appKey: 'postman',
        status: 'completed',
        flowId: mockFlowId,
        parameters: {},
      }),
    }),
  }
}

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
    testStepSpy = vi
      .spyOn(testStepModule, 'default')
      .mockImplementation((() => ({
        executionStep: {
          id: 'execution-step-1',
          stepId: '8c2a70d1-e78b-431e-9069-a4d8f97883f7',
          isFailed: false,
        },
        executionId: '8c2a70d1-e78b-431e-9069-a4d8f97883f8',
      })) as never)

    context = await generateMockContext()
    owner = context.currentUser

    // Create test users
    editor = await generateMockUser('editor')
    viewer = await generateMockUser('viewer')
    nonCollaborator = await generateMockUser('nonCollaborator')
  })

  afterEach(() => vi.clearAllMocks())

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
                flowId: mockFlowId,
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
                  patchAndFetch: vi.fn().mockResolvedValue({
                    id: mockStepId,
                    key: 'sendTransactionalEmail',
                    appKey: 'postman',
                    status: 'completed',
                    flowId: mockFlowId,
                    parameters: {},
                  }),
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

describe('executeStep mutation - testRunMetadata propagation to actions', () => {
  let context: Context
  let flow: Flow
  let actionStep: Step
  let testRunSpy: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.resetAllMocks()

    context = await generateMockContext()

    flow = await Flow.query().insertGraphAndFetch({
      userId: context.currentUser.id,
      name: 'testRunMetadata propagation flow',
      steps: [
        {
          key: 'mock-trigger',
          appKey: 'mock-app',
          type: 'trigger',
          position: 1,
          status: 'completed',
        },
        {
          key: 'mock-action',
          appKey: 'mock-app',
          type: 'action',
          position: 2,
          status: 'completed',
        },
      ],
    })
    actionStep = flow.steps[1]

    const execution = await Execution.query().insertAndFetch({
      flowId: flow.id,
      testRun: true,
    })
    await flow.$query().patch({ testExecutionId: execution.id })

    testRunSpy = vi.fn().mockResolvedValue({})

    vi.spyOn(Step.prototype, 'getApp').mockResolvedValue({
      key: 'mock-app',
      apiBaseUrl: null,
      beforeRequest: [],
      requestErrorHandler: null,
    } as any)
    vi.spyOn(Step.prototype, 'getActionCommand').mockResolvedValue({
      run: vi.fn(),
      testRun: testRunSpy,
      preprocessVariable: undefined,
    } as any)
    vi.spyOn(Step.prototype, 'getNextStep').mockResolvedValue(null)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it("forwards testRunMetadata to the action's testRun handler", async () => {
    const { default: realTestStep } = await vi.importActual<
      typeof import('@/services/test-step.js')
    >('@/services/test-step.js')

    const testRunMetadata = { 'fake:key': { hello: 'world' } }

    await realTestStep({
      stepId: actionStep.id,
      testRunMetadata,
    })

    expect(testRunSpy).toHaveBeenCalledTimes(1)
    expect(testRunSpy.mock.calls[0][1]).toEqual(testRunMetadata)
  })
})
