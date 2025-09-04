import { NotFoundError } from 'objection'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BadUserInputError } from '@/errors/graphql-errors'
import updateStep from '@/graphql/mutations/update-step'
import { TILES_CONNECTION_ID } from '@/helpers/get-shared-connection-details'
import Step from '@/models/step'
import User from '@/models/user'
import Context from '@/types/express/context'

import { generateMockFlow, generateMockStep } from '../mutations/flow.mock'

import { generateMockContext } from './tiles/table.mock'
import { generateMockUser } from './flow.mock'
import {
  createMockWithAccessible,
  setPatchFlowLastUpdatedSpy,
} from './with-accessible.mock'

const mockConnectionId = '8c2a70d1-e78b-431e-9069-a4d8f97883f5'
const mockFlowId = '8c2a70d1-e78b-431e-9069-a4d8f97883f6'
const mockStepId = '8c2a70d1-e78b-431e-9069-a4d8f97883f7'

describe('updateStep mutation', () => {
  let context: Context
  let owner: User
  let editor: User
  let viewer: User
  let nonCollaborator: User
  let patchAndFetchByIdSpy: ReturnType<typeof vi.fn>
  const patchLastUpdatedSpy = vi.fn().mockResolvedValue({})

  // Helper to create connection mock
  const createConnectionMock = (connectionData: any = null) => ({
    findOne: vi.fn().mockResolvedValue(connectionData),
  })

  // Helper to setup $relatedQuery mock
  const setupRelatedQueryMock = (
    stepData?: any,
    connectionData: any = { id: mockConnectionId, key: 'postman' },
  ) => {
    context.currentUser.$relatedQuery = vi
      .fn()
      .mockImplementation((relation, _trx) => {
        if (relation === 'steps') {
          return {
            withGraphFetched: vi.fn().mockReturnValue({
              findOne: vi.fn().mockReturnValue({
                throwIfNotFound: vi.fn().mockImplementation(async (options) => {
                  const result =
                    stepData === null
                      ? null
                      : {
                          id: mockStepId,
                          key: 'sendTransactionalEmail',
                          appKey: 'postman',
                          status: 'completed',
                          flow: {
                            id: mockFlowId,
                            patchLastUpdated: patchLastUpdatedSpy,
                          },
                          ...stepData,
                        }

                  if (result === null) {
                    throw new NotFoundError(
                      options?.message || 'Step not found',
                    )
                  }
                  return result
                }),
              }),
            }),
          }
        }
        if (relation === 'connections') {
          return createConnectionMock(connectionData)
        }
        return {
          findOne: vi.fn().mockResolvedValue(null),
        }
      })
  }

  const genericInputParams = {
    id: mockStepId,
    flow: { id: mockFlowId },
    key: 'sendTransactionalEmail',
    appKey: 'postman',
    parameters: { testParam: 'value' },
    connection: { id: mockConnectionId },
  }

  beforeEach(async () => {
    vi.resetAllMocks()
    // Create a mock context with a current user
    context = await generateMockContext()
    owner = context.currentUser

    // Set the global spy for patchFlowLastUpdated
    setPatchFlowLastUpdatedSpy(patchFlowLastUpdatedSpy)

    // Create test users
    editor = await generateMockUser('editor')
    viewer = await generateMockUser('viewer')
    nonCollaborator = await generateMockUser('nonCollaborator')

    // Create a test flow
    await generateMockFlow(context, mockFlowId)

    // Create a test step
    await generateMockStep(
      context,
      'sendTransactionalEmail',
      'postman',
      'action',
      mockFlowId,
      1,
      { testParam: 'value' },
    )

    // Create spy for patchAndFetchById
    patchAndFetchByIdSpy = vi.fn().mockImplementation((id, data) => ({
      id,
      ...data,
      withGraphFetched: vi.fn().mockResolvedValue({
        id,
        ...data,
        connection: { id: mockConnectionId, userId: owner.id },
        flowId: mockFlowId,
        flow: { userId: owner.id },
      }),
    }))

    // Mock Step.transaction
    vi.spyOn(Step, 'transaction').mockImplementation(async (callback) => {
      const trx = {
        raw: vi.fn().mockResolvedValue({}),
      } as any
      return callback(trx)
    })

    // Mock Step.query
    vi.spyOn(Step, 'query').mockReturnValue({
      patchAndFetchById: patchAndFetchByIdSpy,
    } as any)

    // Mock context.currentUser.withAccessible for steps
    context.currentUser.withAccessible = createMockWithAccessible({
      owner,
      currentUser: context.currentUser,
      stepKey: 'sendTransactionalEmail',
      stepAppKey: 'postman',
      connectionKey: 'postman',
      stepId: mockStepId,
      connectionId: mockConnectionId,
    })
  })

  it('should successfully update a step', async () => {
    const input = {
      ...genericInputParams,
      parameters: { updatedParam: 'newValue' },
    }

    await updateStep(null, { input }, context)

    expect(patchAndFetchByIdSpy).toHaveBeenCalledWith(mockStepId, {
      key: 'sendTransactionalEmail',
      appKey: 'postman',
      connectionId: mockConnectionId,
      parameters: { updatedParam: 'newValue' },
      status: 'completed',
      config: {},
    })
  })

  it('should update step with a connection', async () => {
    const connectionId = mockConnectionId
    const input = {
      ...genericInputParams,
      connection: { id: connectionId },
    }

    await updateStep(null, { input }, context)

    expect(patchAndFetchByIdSpy).toHaveBeenCalledWith(mockStepId, {
      key: 'sendTransactionalEmail',
      appKey: 'postman',
      connectionId,
      parameters: { testParam: 'value' },
      status: 'completed',
      config: {},
    })
  })

  it('should throw error if connection not found', async () => {
    const input = {
      ...genericInputParams,
      parameters: { testParam: 'value' },
      connection: { id: 'non-existent-connection' },
    }

    context.currentUser.withAccessible = createMockWithAccessible({
      owner,
      currentUser: context.currentUser,
      stepKey: 'sendTransactionalEmail',
      stepAppKey: 'postman',
      connectionKey: 'postman',
      stepId: mockStepId,
      connectionId: mockConnectionId,
      connectionNotFound: true,
    })

    await expect(updateStep(null, { input }, context)).rejects.toThrowError(
      BadUserInputError,
    )
    expect(patchAndFetchByIdSpy).not.toHaveBeenCalled()
  })

  it('should throw error if step not found', async () => {
    const input = {
      ...genericInputParams,
      id: 'non-existent-step',
    }

    context.currentUser.withAccessible = createMockWithAccessible({
      owner,
      currentUser: context.currentUser,
      stepKey: 'sendTransactionalEmail',
      stepAppKey: 'postman',
      connectionKey: 'postman',
      stepId: mockStepId,
      connectionId: mockConnectionId,
      stepNotFound: true,
    })

    await expect(updateStep(null, { input }, context)).rejects.toThrow(
      NotFoundError,
    )
    expect(patchAndFetchByIdSpy).not.toHaveBeenCalled()
  })

  it('should set status to incomplete when key or appKey changes', async () => {
    const input = {
      ...genericInputParams,
      key: 'newKey',
    }

    await updateStep(null, { input }, context)

    expect(patchAndFetchByIdSpy).toHaveBeenCalledWith(mockStepId, {
      key: 'newKey',
      appKey: 'postman',
      connectionId: mockConnectionId,
      parameters: { testParam: 'value' },
      status: 'incomplete',
      config: {},
    })
  })

  it('should set status to incomplete when explicitly requested', async () => {
    const input = {
      ...genericInputParams,
      status: 'incomplete',
    }

    await updateStep(null, { input }, context)

    expect(patchAndFetchByIdSpy).toHaveBeenCalledWith(mockStepId, {
      key: 'sendTransactionalEmail',
      appKey: 'postman',
      connectionId: mockConnectionId,
      parameters: { testParam: 'value' },
      status: 'incomplete',
      config: {},
    })
  })

  it('should update step name', async () => {
    const input = {
      ...genericInputParams,
      config: { stepName: 'Updated Step Name' },
    }

    await updateStep(null, { input }, context)

    expect(patchAndFetchByIdSpy).toHaveBeenCalledWith(mockStepId, {
      key: 'sendTransactionalEmail',
      appKey: 'postman',
      connectionId: mockConnectionId,
      parameters: { testParam: 'value' },
      status: 'completed',
      config: { stepName: 'Updated Step Name' },
    })
  })

  it('should allow for empty step name', async () => {
    const input = {
      ...genericInputParams,
      config: { stepName: '' },
    }

    await updateStep(null, { input }, context)

    expect(patchAndFetchByIdSpy).toHaveBeenCalledWith(mockStepId, {
      key: 'sendTransactionalEmail',
      appKey: 'postman',
      connectionId: mockConnectionId,
      parameters: { testParam: 'value' },
      status: 'completed',
      config: { stepName: '' },
    })
  })

  it('updating step name should not update template config', async () => {
    // Override the steps query to return template config
    context.currentUser.withAccessible = createMockWithAccessible({
      owner,
      currentUser: context.currentUser,
      stepKey: 'sendTransactionalEmail',
      stepAppKey: 'postman',
      connectionKey: 'postman',
      stepId: mockStepId,
      connectionId: mockConnectionId,
      stepConfig: {
        stepName: 'some-step-name',
        templateConfig: { appEventKey: 'existingAppEventKey' },
      },
      stepConnection: { id: mockConnectionId },
    })

    const input = {
      ...genericInputParams,
      config: { stepName: 'Updated Step Name' },
    }

    await updateStep(null, { input }, context)

    expect(patchAndFetchByIdSpy).toHaveBeenCalledWith(mockStepId, {
      key: 'sendTransactionalEmail',
      appKey: 'postman',
      connectionId: mockConnectionId,
      parameters: { testParam: 'value' },
      status: 'completed',
      config: {
        stepName: 'Updated Step Name',
        templateConfig: { appEventKey: 'existingAppEventKey' },
      },
    })

    // Verify the existing templateConfig was preserved in the result
    expect(
      patchAndFetchByIdSpy.mock.results[0].value.config.templateConfig,
    ).toEqual({
      appEventKey: 'existingAppEventKey',
    })
    expect(patchAndFetchByIdSpy.mock.results[0].value.config.stepName).toEqual(
      'Updated Step Name',
    )
  })

  it('updating empty step name should not update template config', async () => {
    // Override the steps query to return template config
    context.currentUser.withAccessible = createMockWithAccessible({
      owner,
      currentUser: context.currentUser,
      stepKey: 'sendTransactionalEmail',
      stepAppKey: 'postman',
      connectionKey: 'postman',
      stepId: mockStepId,
      connectionId: mockConnectionId,
      stepConfig: {
        stepName: 'some-step-name',
        templateConfig: { appEventKey: 'existingAppEventKey' },
      },
      stepConnection: { id: mockConnectionId },
    })

    const input = {
      ...genericInputParams,
      config: { stepName: '' },
    }

    await updateStep(null, { input }, context)

    expect(patchAndFetchByIdSpy).toHaveBeenCalledWith(mockStepId, {
      key: 'sendTransactionalEmail',
      appKey: 'postman',
      connectionId: mockConnectionId,
      parameters: { testParam: 'value' },
      status: 'completed',
      config: {
        stepName: '',
        templateConfig: { appEventKey: 'existingAppEventKey' },
      },
    })

    // Verify the existing templateConfig was preserved in the result
    expect(
      patchAndFetchByIdSpy.mock.results[0].value.config.templateConfig,
    ).toEqual({
      appEventKey: 'existingAppEventKey',
    })
    expect(patchAndFetchByIdSpy.mock.results[0].value.config.stepName).toEqual(
      '',
    )
  })

  it('should call patchLastUpdated when updating a step', async () => {
    await updateStep(null, { input: { ...genericInputParams } }, context)
    expect(patchLastUpdatedSpy).toHaveBeenCalledTimes(1)
  })

  it('should throw an error if the parameters are invalid', async () => {
    const input = {
      ...genericInputParams,
      appKey: 'toolbox',
      key: 'forEach',
      parameters: { items: 'not a valid items variable' },
    }
    await expect(updateStep(null, { input }, context)).rejects.toThrow(
      BadUserInputError,
    )
  })

  describe('access control', () => {
    it.each(['nonCollaborator', 'viewer'])(
      'should throw error if user does not have necessary permissions: %s',
      async (role) => {
        context.currentUser =
          role === 'nonCollaborator' ? nonCollaborator : viewer
        const input = { ...genericInputParams }

        // Mock the access control to return null for step (no access)
        context.currentUser.withAccessible = createMockWithAccessible({
          owner,
          currentUser: context.currentUser,
          stepKey: 'sendTransactionalEmail',
          stepAppKey: 'postman',
          connectionKey: 'postman',
          stepId: mockStepId,
          connectionId: mockConnectionId,
          stepNotFound: true,
        })

        await expect(updateStep(null, { input }, context)).rejects.toThrow(
          BadUserInputError,
        )
        expect(patchAndFetchByIdSpy).not.toHaveBeenCalled()
      },
    )

    it.each(['editor', 'owner'])(
      'should allow updating of step if user has the permissions: %s',
      async (role) => {
        context.currentUser = role === 'editor' ? editor : owner
        const input = {
          ...genericInputParams,
          parameters: { updatedParam: 'newValue' },
        }

        // Mock the access control to return step data (has access)
        context.currentUser.withAccessible = createMockWithAccessible({
          owner,
          currentUser: context.currentUser,
          stepKey: 'sendTransactionalEmail',
          stepAppKey: 'postman',
          connectionKey: 'postman',
          stepId: mockStepId,
          connectionId: mockConnectionId,
        })

        await expect(
          updateStep(null, { input }, context),
        ).resolves.not.toThrow()
        expect(patchAndFetchByIdSpy).toHaveBeenCalledWith(mockStepId, {
          key: 'sendTransactionalEmail',
          appKey: 'postman',
          connectionId: mockConnectionId,
          parameters: { updatedParam: 'newValue' },
          status: 'completed',
          config: {},
        })
      },
    )
  })

  describe('FlowConnections integration', () => {
    let patchSpy: any
    let addSpy: any

    beforeEach(async () => {
      // Mock FlowConnections methods
      vi.mock('@/models/flow-connections', () => ({
        default: {
          patchFlowConnectionMetadata: vi.fn(),
          addFlowConnection: vi.fn(),
        },
      }))

      const { default: FlowConnections } = await import(
        '@/models/flow-connections'
      )
      patchSpy = vi.spyOn(FlowConnections, 'patchFlowConnectionMetadata')
      addSpy = vi.spyOn(FlowConnections, 'addFlowConnection')

      context.currentUser.withAccessible = createMockWithAccessible({
        owner,
        currentUser: owner,
        stepKey: 'sendMessage',
        stepAppKey: 'slack',
        connectionKey: 'slack',
        stepId: mockStepId,
        connectionId: mockConnectionId,
        flowId: mockFlowId,
        stepRole: 'owner',
      })
    })

    it('should call patchFlowConnectionMetadata when app has connection fields and parameter exists', async () => {
      const input = {
        id: mockStepId,
        flow: { id: mockFlowId },
        key: 'sendMessage',
        appKey: 'slack',
        parameters: { channel: 'C1234567890' },
        connection: { id: mockConnectionId },
      }

      await updateStep(null, { input }, context)

      expect(patchSpy).toHaveBeenCalledWith({
        flowId: mockFlowId,
        connectionId: mockConnectionId,
        userId: owner.id,
        parameterKey: 'channel',
        parameterValue: 'C1234567890',
      })
      expect(addSpy).not.toHaveBeenCalled()
    })

    it('should call addFlowConnection when app has connection fields but parameter does not exist', async () => {
      const input = {
        ...genericInputParams,
        appKey: 'slack',
        parameters: { message: 'Hello world' }, // No channel parameter
        connection: { id: mockConnectionId },
      }

      await updateStep(null, { input }, context)

      expect(addSpy).toHaveBeenCalledWith({
        flowId: mockFlowId,
        connectionId: mockConnectionId,
        userId: owner.id,
      })
      expect(patchSpy).not.toHaveBeenCalled()
    })

    it('should not call FlowConnections methods when step role is not owner', async () => {
      const { default: FlowConnections } = await import(
        '@/models/flow-connections'
      )
      const patchSpy = vi.spyOn(FlowConnections, 'patchFlowConnectionMetadata')
      const addSpy = vi.spyOn(FlowConnections, 'addFlowConnection')

      // Mock step with role 'editor' (not owner)
      context.currentUser.withAccessible = createMockWithAccessible({
        owner,
        currentUser: owner,
        stepKey: 'sendMessage',
        stepAppKey: 'slack',
        connectionKey: 'slack',
        stepId: mockStepId,
        connectionId: mockConnectionId,
        flowId: mockFlowId,
        stepRole: 'editor', // Not owner
      })

      const input = {
        ...genericInputParams,
        appKey: 'slack',
        parameters: { channel: 'C1234567890' },
        connection: { id: mockConnectionId },
      }

      await updateStep(null, { input }, context)

      expect(patchSpy).not.toHaveBeenCalled()
      expect(addSpy).not.toHaveBeenCalled()
    })

    it('should not call FlowConnections methods when app does not have connection fields', async () => {
      const { default: FlowConnections } = await import(
        '@/models/flow-connections'
      )
      const patchSpy = vi.spyOn(FlowConnections, 'patchFlowConnectionMetadata')
      const addSpy = vi.spyOn(FlowConnections, 'addFlowConnection')

      // Mock step with postman that doesn't have connection fields
      context.currentUser.withAccessible = createMockWithAccessible({
        owner,
        currentUser: owner,
        stepKey: 'sendTransactionalEmail',
        stepAppKey: 'postman',
        connectionKey: 'postman',
        stepId: mockStepId,
        connectionId: mockConnectionId,
        flowId: mockFlowId,
        stepRole: 'owner',
      })

      const input = {
        ...genericInputParams,
        appKey: 'postman',
        parameters: { testParam: 'value' },
        connection: {},
      }

      await updateStep(null, { input }, context)

      expect(patchSpy).not.toHaveBeenCalled()
      expect(addSpy).not.toHaveBeenCalled()
    })

    it('should call patchFlowConnectionMetadata for telegram-bot app with chatId parameter', async () => {
      const { default: FlowConnections } = await import(
        '@/models/flow-connections'
      )
      const patchSpy = vi.spyOn(FlowConnections, 'patchFlowConnectionMetadata')
      const addSpy = vi.spyOn(FlowConnections, 'addFlowConnection')

      // Mock step with telegram-bot app
      context.currentUser.withAccessible = createMockWithAccessible({
        owner,
        currentUser: owner,
        stepKey: 'sendMessage',
        stepAppKey: 'telegram-bot',
        connectionKey: 'telegram-bot',
        stepId: mockStepId,
        connectionId: mockConnectionId,
        flowId: mockFlowId,
        stepRole: 'owner',
      })

      const input = {
        ...genericInputParams,
        appKey: 'telegram-bot',
        parameters: { chatId: '123456789' },
      }

      await updateStep(null, { input }, context)

      expect(patchSpy).toHaveBeenCalledWith({
        flowId: mockFlowId,
        connectionId: mockConnectionId,
        userId: owner.id,
        parameterKey: 'chatId',
        parameterValue: '123456789',
      })
      expect(addSpy).not.toHaveBeenCalled()
    })

    it('should call patchFlowConnectionMetadata for tiles app with tableId parameter', async () => {
      const { default: FlowConnections } = await import(
        '@/models/flow-connections'
      )
      const patchSpy = vi.spyOn(FlowConnections, 'patchFlowConnectionMetadata')
      const addSpy = vi.spyOn(FlowConnections, 'addFlowConnection')

      // Mock step with tiles app
      context.currentUser.withAccessible = createMockWithAccessible({
        owner,
        currentUser: owner,
        stepKey: 'readAction',
        stepAppKey: 'tiles',
        connectionKey: 'tiles',
        stepId: mockStepId,
        connectionId: mockConnectionId,
        flowId: mockFlowId,
        stepRole: 'owner',
      })

      const input = {
        ...genericInputParams,
        appKey: 'tiles',
        parameters: { tableId: 'table-123' },
      }

      await updateStep(null, { input }, context)

      expect(patchSpy).toHaveBeenCalledWith({
        flowId: mockFlowId,
        connectionId: TILES_CONNECTION_ID,
        userId: owner.id,
        parameterKey: 'tableId',
        parameterValue: 'table-123',
      })
      expect(addSpy).not.toHaveBeenCalled()
    })
  })
})
