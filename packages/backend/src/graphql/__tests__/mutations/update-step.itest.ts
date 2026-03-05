import { randomUUID } from 'crypto'
import { NotFoundError } from 'objection'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BadUserInputError } from '@/errors/graphql-errors'
import updateStep from '@/graphql/mutations/update-step'
import Flow from '@/models/flow'
import FlowCollaborator from '@/models/flow-collaborators'
import Step from '@/models/step'
import TableCollaborator from '@/models/table-collaborators'
import User from '@/models/user'
import Context from '@/types/express/context'

import { generateMockFlow, generateMockStep } from '../mutations/flow.mock'

import { generateMockContext } from './tiles/table.mock'
import { generateMockUser } from './flow.mock'
import { mockConnectionsRelatedQuery } from './related-query-mock'
import {
  createMockWithAccessibleSteps,
  setAssertNotUpdatedSinceSpy,
  setPatchLastUpdatedSpy,
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
  let testFlow: Flow
  let testFlowISODateString: string
  let testInputTimestampString: string
  let patchAndFetchByIdSpy: ReturnType<typeof vi.fn>
  const patchLastUpdatedSpy = vi.fn().mockResolvedValue({})
  const assertNotUpdatedSinceSpy = vi.fn().mockResolvedValue({})

  let genericInputParams = {
    id: mockStepId,
    flow: { id: mockFlowId, updatedAt: testFlowISODateString },
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
    setPatchLastUpdatedSpy(patchLastUpdatedSpy)
    setAssertNotUpdatedSinceSpy(assertNotUpdatedSinceSpy)

    // Create test users
    editor = await generateMockUser('editor')
    viewer = await generateMockUser('viewer')
    nonCollaborator = await generateMockUser('nonCollaborator')

    // Create a test flow
    testFlow = await generateMockFlow(context, mockFlowId)
    testFlowISODateString = testFlow.updatedAt
    testInputTimestampString = String(new Date(testFlow.updatedAt).getTime())

    // Set up the patchFlowLastUpdatedSpy to return an updated timestamp
    patchLastUpdatedSpy.mockResolvedValue({
      updatedAt: new Date(Date.now() + 1000).toISOString(), // 1 second later
    })
    assertNotUpdatedSinceSpy.mockResolvedValue(true)

    genericInputParams = {
      ...genericInputParams,
      flow: { id: mockFlowId, updatedAt: testInputTimestampString },
    }

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
        flow: { userId: owner.id, updatedAt: testFlowISODateString },
      }),
    }))

    // Mock Step.query
    vi.spyOn(Step, 'query').mockReturnValue({
      patchAndFetchById: patchAndFetchByIdSpy,
    } as any)

    // Mock context.currentUser.withAccessible for steps
    context.currentUser.withAccessibleSteps = createMockWithAccessibleSteps({
      owner,
      currentUser: context.currentUser,
      flowId: mockFlowId,
      stepKey: 'sendTransactionalEmail',
      stepAppKey: 'postman',
      stepConnection: { id: mockConnectionId, userId: owner.id },
      flowUpdatedAt: testFlowISODateString,
    })

    mockConnectionsRelatedQuery(context.currentUser, {
      connectionKey: 'postman',
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
      updatedBy: context.currentUser.id,
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
      updatedBy: context.currentUser.id,
    })
  })

  it('should throw error if connection not found', async () => {
    const input = {
      ...genericInputParams,
      parameters: { testParam: 'value' },
      connection: { id: randomUUID() },
    }

    mockConnectionsRelatedQuery(context.currentUser, {
      connectionId: randomUUID(),
      connectionKey: 'postman',
      connectionNotFound: true,
    })

    await expect(updateStep(null, { input }, context)).rejects.toThrow(
      NotFoundError,
    )
    expect(patchAndFetchByIdSpy).not.toHaveBeenCalled()
  })

  it('should throw error if step not found', async () => {
    const input = {
      ...genericInputParams,
      id: 'non-existent-step',
    }

    context.currentUser.withAccessibleSteps = createMockWithAccessibleSteps({
      owner,
      currentUser: context.currentUser,
      stepKey: 'sendTransactionalEmail',
      stepAppKey: 'postman',
      stepNotFound: true,
    })

    await expect(updateStep(null, { input }, context)).rejects.toThrow(
      BadUserInputError,
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
      updatedBy: context.currentUser.id,
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
      updatedBy: context.currentUser.id,
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
      updatedBy: context.currentUser.id,
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
      updatedBy: context.currentUser.id,
    })
  })

  it('updating step name should not update template config', async () => {
    // Override the steps query to return template config
    context.currentUser.withAccessibleSteps = createMockWithAccessibleSteps({
      owner,
      currentUser: context.currentUser,
      stepKey: 'sendTransactionalEmail',
      stepAppKey: 'postman',
      stepId: mockStepId,
      stepConfig: {
        stepName: 'some-step-name',
        templateConfig: { appEventKey: 'existingAppEventKey' },
      },
      stepConnection: { id: mockConnectionId },
      flowUpdatedAt: testFlowISODateString,
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
      updatedBy: context.currentUser.id,
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
    context.currentUser.withAccessibleSteps = createMockWithAccessibleSteps({
      owner,
      currentUser: context.currentUser,
      stepKey: 'sendTransactionalEmail',
      stepAppKey: 'postman',
      stepConfig: {
        stepName: 'some-step-name',
        templateConfig: { appEventKey: 'existingAppEventKey' },
      },
      flowUpdatedAt: testFlowISODateString,
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
      updatedBy: context.currentUser.id,
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
    // Mock the access control to return step data (has access)
    context.currentUser.withAccessibleSteps = createMockWithAccessibleSteps({
      owner,
      currentUser: context.currentUser,
      stepKey: 'sendTransactionalEmail',
      stepAppKey: 'postman',
      flowUpdatedAt: testFlowISODateString,
    })
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
        context.currentUser.withAccessibleSteps = createMockWithAccessibleSteps(
          {
            owner,
            currentUser: context.currentUser,
            stepKey: 'sendTransactionalEmail',
            stepAppKey: 'postman',
            stepNotFound: true,
            flowUpdatedAt: testFlowISODateString,
          },
        )

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
        context.currentUser.withAccessibleSteps = createMockWithAccessibleSteps(
          {
            owner,
            currentUser: context.currentUser,
            stepKey: 'sendTransactionalEmail',
            stepAppKey: 'postman',
            flowUpdatedAt: testFlowISODateString,
          },
        )

        mockConnectionsRelatedQuery(context.currentUser, {
          connectionId: mockConnectionId,
          connectionKey: 'postman',
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
          updatedBy: context.currentUser.id,
        })
      },
    )
  })

  describe('FlowConnections integration', () => {
    let patchSpy: any
    let addSpy: any

    beforeEach(async () => {
      const { default: FlowConnections } = await import(
        '@/models/flow-connections'
      )
      patchSpy = vi.spyOn(FlowConnections, 'patchFlowConnectionMetadata')
      addSpy = vi.spyOn(FlowConnections, 'addFlowConnection')

      context.currentUser.withAccessibleSteps = createMockWithAccessibleSteps({
        owner,
        currentUser: owner,
        stepKey: 'sendMessage',
        stepAppKey: 'slack',
        flowId: mockFlowId,
        stepRole: 'owner',
        flowUpdatedAt: testFlowISODateString,
      })

      mockConnectionsRelatedQuery(context.currentUser, {
        connectionKey: 'slack',
        connectionId: mockConnectionId,
      })
    })

    it('should call patchFlowConnectionMetadata or addFlowConnection when its an excel app', async () => {
      context.currentUser.withAccessibleSteps = createMockWithAccessibleSteps({
        owner,
        currentUser: context.currentUser,
        stepKey: 'sendTransactionalEmail',
        stepAppKey: 'postman',
        flowId: mockFlowId,
        flowUpdatedAt: testFlowISODateString,
      })

      mockConnectionsRelatedQuery(context.currentUser, {
        connectionKey: 'm365-excel',
        connectionId: mockConnectionId,
      })

      const input = {
        ...genericInputParams,
        appKey: 'm365-excel',
        parameters: { fileId: '1234567890' },
      }

      await updateStep(null, { input }, context)

      expect(patchSpy).toHaveBeenCalledWith({
        flowId: mockFlowId,
        connectionId: mockConnectionId,
        parameterKey: 'fileId',
        parameterValue: '1234567890',
        addedBy: owner.id,
        trx: expect.anything(),
      })
      expect(addSpy).toHaveBeenCalled()
    })

    it('should call patchFlowConnectionMetadata when app has connection fields and parameter exists', async () => {
      const input = {
        id: mockStepId,
        flow: { id: mockFlowId, updatedAt: testFlowISODateString },
        key: 'sendMessage',
        appKey: 'slack',
        parameters: { channel: 'C1234567890' },
        connection: { id: mockConnectionId },
      }

      await updateStep(null, { input }, context)

      expect(patchSpy).not.toHaveBeenCalled()
      expect(addSpy).toHaveBeenCalledWith({
        flowId: mockFlowId,
        connectionId: mockConnectionId,
        addedBy: owner.id,
        connectionType: 'connection',
        trx: expect.anything(),
      })
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
        addedBy: owner.id,
        connectionType: 'connection',
        trx: expect.anything(),
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
      context.currentUser.withAccessibleSteps = createMockWithAccessibleSteps({
        owner,
        currentUser: owner,
        stepKey: 'sendMessage',
        stepAppKey: 'slack',
        flowId: mockFlowId,
        stepRole: 'editor', // Not owner
        flowUpdatedAt: testFlowISODateString,
      })

      // Mock FlowConnections query for getConnection validation
      // Since role is 'editor', getConnection will query FlowConnections table
      vi.spyOn(FlowConnections, 'query').mockReturnValue({
        findOne: vi.fn().mockReturnValue({
          withGraphFetched: vi.fn().mockReturnValue({
            throwIfNotFound: vi.fn().mockResolvedValue({
              connection: { id: mockConnectionId, key: 'slack' },
            }),
          }),
        }),
      } as any)

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
      context.currentUser.withAccessibleSteps = createMockWithAccessibleSteps({
        owner,
        currentUser: owner,
        stepKey: 'sendTransactionalEmail',
        stepAppKey: 'postman',
        stepRole: 'owner',
        flowUpdatedAt: testFlowISODateString,
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

    it('should call add to flow_connections and add table collaborator for tiles app with tableId parameter', async () => {
      const mockTableId = randomUUID()
      const { default: FlowConnections } = await import(
        '@/models/flow-connections'
      )
      // mock the check that the user has access to the tile
      vi.spyOn(TableCollaborator, 'hasAccess').mockResolvedValue(undefined)
      const addCollaboratorSpy = vi
        .spyOn(TableCollaborator, 'upgradeOrInsertCollaborator')
        .mockResolvedValue(undefined)
      const patchSpy = vi.spyOn(FlowConnections, 'patchFlowConnectionMetadata')
      const addSpy = vi
        .spyOn(FlowConnections, 'addFlowConnection')
        .mockResolvedValue({
          flowId: mockFlowId,
          connectionId: mockTableId,
          addedBy: owner.id,
          connectionType: 'table',
          metadata: {},
        } as any)
      const getCollaboratorsSpy = vi
        .spyOn(FlowCollaborator, 'getCollaborators')
        .mockResolvedValue([
          { userId: editor.id, role: 'editor' } as any,
          { userId: viewer.id, role: 'viewer' } as any,
        ])

      // Mock step with tiles app
      context.currentUser.withAccessibleSteps = createMockWithAccessibleSteps({
        owner,
        currentUser: owner,
        stepKey: 'readAction',
        stepAppKey: 'tiles',
        stepRole: 'owner',
        flowUpdatedAt: testFlowISODateString,
      })

      const input = {
        ...genericInputParams,
        appKey: 'tiles',
        connection: {},
        parameters: { tableId: mockTableId },
      }

      await updateStep(null, { input }, context)

      expect(patchSpy).not.toHaveBeenCalled()
      expect(addSpy).toHaveBeenCalledWith({
        flowId: mockFlowId,
        connectionId: mockTableId,
        addedBy: owner.id,
        connectionType: 'table',
        trx: expect.anything(),
      })
      expect(getCollaboratorsSpy).toHaveBeenCalled()
      expect(getCollaboratorsSpy).toHaveBeenCalledWith({
        flowId: mockFlowId,
        trx: expect.anything(),
      })
      expect(addCollaboratorSpy).toHaveBeenCalledTimes(2)
      expect(addCollaboratorSpy).toHaveBeenCalledWith({
        userId: editor.id,
        tableId: mockTableId,
        role: 'editor',
        trx: expect.anything(),
      })
      expect(addCollaboratorSpy).toHaveBeenCalledWith({
        userId: viewer.id,
        tableId: mockTableId,
        role: 'viewer',
        trx: expect.anything(),
      })
    })
  })
})
