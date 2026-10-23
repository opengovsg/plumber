import { randomUUID } from 'crypto'

import { NotFoundError } from 'objection'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import apps from '@/apps'
import { BadUserInputError } from '@/errors/graphql-errors'
import updateStep from '@/graphql/mutations/update-step'
import Flow from '@/models/flow'
import FlowCollaborator from '@/models/flow-collaborators'
import Step from '@/models/step'
import TableCollaborator from '@/models/table-collaborators'
import User from '@/models/user'
import Context from '@/types/express/context'

import { generateMockFlow, generateMockStep } from '../mutations/flow.mock'
import { generateMockUser } from './flow.mock'
import { mockConnectionsRelatedQuery } from './related-query-mock'
import { generateMockContext } from './tiles/table.mock'
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
      key: 'sendMessage',
      appKey: 'telegram-bot',
      //  remove connection from input for testing purposes
      connection: { id: null } as any,
    }

    await updateStep(null, { input }, context)

    expect(patchAndFetchByIdSpy).toHaveBeenCalledWith(mockStepId, {
      key: 'sendMessage',
      appKey: 'telegram-bot',
      connectionId: null,
      parameters: { testParam: 'value' },
      status: 'incomplete',
      config: {},
      updatedBy: context.currentUser.id,
    })
  })

  it('should throw an error if the key or appKey is not found', async () => {
    const input = {
      ...genericInputParams,
      key: 'invalidKey',
    }

    await expect(updateStep(null, { input }, context)).rejects.toThrow(
      BadUserInputError,
    )

    const input2 = {
      ...genericInputParams,
      appKey: 'invalidAppKey',
    }

    await expect(updateStep(null, { input: input2 }, context)).rejects.toThrow(
      BadUserInputError,
    )
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

  describe('version assignment', () => {
    it('does not include version in patch when app has no stepTransformer', async () => {
      // postman has no stepTransformer
      await updateStep(null, { input: { ...genericInputParams } }, context)

      expect(patchAndFetchByIdSpy).toHaveBeenCalledWith(
        mockStepId,
        expect.not.objectContaining({ version: expect.anything() }),
      )
    })

    it('transforms parameters and sets latest version when app has a stepTransformer', async () => {
      const mockTransformStepParameters = vi
        .fn()
        .mockReturnValue({ transformed: true })
      const mockGetLatestStepVersion = vi.fn().mockReturnValue(3)
      const originalPostman = apps['postman']
      apps['postman'] = {
        ...originalPostman,
        stepTransformer: {
          transformStepParameters: mockTransformStepParameters,
          getLatestStepVersion: mockGetLatestStepVersion,
        },
      }

      context.currentUser.withAccessibleSteps = createMockWithAccessibleSteps({
        owner,
        currentUser: context.currentUser,
        stepKey: 'sendTransactionalEmail',
        stepAppKey: 'postman',
        stepVersion: 1,
        stepConnection: { id: mockConnectionId, userId: owner.id },
        flowUpdatedAt: testFlowISODateString,
      })

      try {
        await updateStep(null, { input: { ...genericInputParams } }, context)

        expect(mockTransformStepParameters).toHaveBeenCalledWith(
          'sendTransactionalEmail',
          genericInputParams.parameters,
          1, // step.version is undefined in mock, falls back to 1
        )
        expect(mockGetLatestStepVersion).toHaveBeenCalledWith(
          'sendTransactionalEmail',
        )
        expect(patchAndFetchByIdSpy).toHaveBeenCalledWith(
          mockStepId,
          expect.objectContaining({
            parameters: { transformed: true },
            version: 3,
          }),
        )
      } finally {
        apps['postman'] = originalPostman
      }
    })

    it('uses step.version from DB (not frontend) when transforming — stale frontend fix', async () => {
      const mockTransformStepParameters = vi
        .fn()
        .mockReturnValue({ upgraded: true })
      const mockGetLatestStepVersion = vi.fn().mockReturnValue(2)
      const originalPostman = apps['postman']
      apps['postman'] = {
        ...originalPostman,
        stepTransformer: {
          transformStepParameters: mockTransformStepParameters,
          getLatestStepVersion: mockGetLatestStepVersion,
        },
      }

      // DB step is at version 1 (old format)
      context.currentUser.withAccessibleSteps = createMockWithAccessibleSteps({
        owner,
        currentUser: context.currentUser,
        stepKey: 'sendTransactionalEmail',
        stepAppKey: 'postman',
        stepVersion: 1,
        stepConnection: { id: mockConnectionId, userId: owner.id },
        flowUpdatedAt: testFlowISODateString,
      })

      try {
        // Frontend sends params in old format (stale)
        await updateStep(
          null,
          {
            input: {
              ...genericInputParams,
              parameters: { oldFormatParam: 'value' },
            },
          },
          context,
        )

        // Transformer should be called with DB version (1), not whatever frontend thinks
        expect(mockTransformStepParameters).toHaveBeenCalledWith(
          'sendTransactionalEmail',
          { oldFormatParam: 'value' },
          1,
        )
        expect(patchAndFetchByIdSpy).toHaveBeenCalledWith(
          mockStepId,
          expect.objectContaining({
            parameters: { upgraded: true },
            version: 2,
          }),
        )
      } finally {
        apps['postman'] = originalPostman
      }
    })
  })

  describe('FlowConnections integration', () => {
    let patchSpy: any
    let addSpy: any

    beforeEach(async () => {
      // esModuleInterop double-wraps .default on a value-level dynamic import of a
      // nodenext CJS module; typeof import(...) models it correctly, so cast through it.
      const { default: FlowConnections } =
        (await import('@/models/flow-connections.js')) as unknown as typeof import('@/models/flow-connections.js')
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
        stepKey: 'createTableRow',
        stepAppKey: 'm365-excel',
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
        key: 'createTableRow',
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
        key: 'sendMessageToChannel',
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
        key: 'sendMessageToChannel',
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
      const { default: FlowConnections } =
        (await import('@/models/flow-connections.js')) as unknown as typeof import('@/models/flow-connections.js')
      const patchSpy = vi.spyOn(FlowConnections, 'patchFlowConnectionMetadata')
      const addSpy = vi.spyOn(FlowConnections, 'addFlowConnection')

      // Mock step with role 'editor' (not owner)
      context.currentUser.withAccessibleSteps = createMockWithAccessibleSteps({
        owner,
        currentUser: owner,
        stepKey: 'sendMessageToChannel',
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
        key: 'sendMessageToChannel',
        appKey: 'slack',
        parameters: { channel: 'C1234567890' },
        connection: { id: mockConnectionId },
      }

      await updateStep(null, { input }, context)

      expect(patchSpy).not.toHaveBeenCalled()
      expect(addSpy).not.toHaveBeenCalled()
    })

    it('should not call FlowConnections methods when app does not have connection fields', async () => {
      const { default: FlowConnections } =
        (await import('@/models/flow-connections.js')) as unknown as typeof import('@/models/flow-connections.js')
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
      const { default: FlowConnections } =
        (await import('@/models/flow-connections.js')) as unknown as typeof import('@/models/flow-connections.js')
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
        stepKey: 'createTileRow',
        stepAppKey: 'tiles',
        stepRole: 'owner',
        flowUpdatedAt: testFlowISODateString,
      })

      const input = {
        ...genericInputParams,
        appKey: 'tiles',
        key: 'createTileRow',
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

// Real-DB integration tests, kept separate from the mock-based suite above so
// writes hit real flow steps and can actually roll back.
describe('updateStep endStepId config merge', () => {
  let testFlow: Flow
  let owner: User
  let context: Context
  let flowTimestamp: string

  const flowInput = () => ({ id: testFlow.id, updatedAt: flowTimestamp })

  async function seedSteps(
    specs: Array<{
      key: string | null
      appKey: string | null
      type: 'trigger' | 'action'
      config?: Record<string, any>
      parameters?: Record<string, any>
    }>,
  ): Promise<Step[]> {
    return testFlow.$relatedQuery('steps').insertAndFetch(
      specs.map((spec, index) => ({
        key: spec.key,
        appKey: spec.appKey,
        type: spec.type,
        position: index + 1,
        parameters: spec.parameters ?? {},
        config: spec.config ?? {},
      })),
    ) as unknown as Promise<Step[]>
  }

  const reload = async (id: string): Promise<Step> =>
    Step.query().findById(id).throwIfNotFound()

  beforeEach(async () => {
    vi.restoreAllMocks()

    owner = await User.query().findOne({ email: 'tester@open.gov.sg' })
    context = {
      req: null,
      currentUser: owner,
      res: null,
      isAdminOperation: false,
    } as unknown as Context

    testFlow = await owner.$relatedQuery('flows').insertAndFetch({
      name: 'endStep Update Flow',
      updatedBy: owner.id,
    })
    flowTimestamp = String(new Date(testFlow.updatedAt).getTime())

    vi.spyOn(Flow.prototype, 'patchLastUpdated').mockResolvedValue({
      ...testFlow,
      updatedAt: testFlow.updatedAt,
    } as any)
  })

  it('writes a self-referencing endStepId onto a new-style if-then', async () => {
    const [, ifThen] = await seedSteps([
      { key: 'newSubmission', appKey: 'formsg', type: 'trigger' },
      { key: 'ifThen', appKey: 'toolbox', type: 'action' },
    ])

    await updateStep(
      null,
      {
        input: {
          id: ifThen.id,
          flow: flowInput(),
          key: 'ifThen',
          appKey: 'toolbox',
          connection: {},
          parameters: {},
          config: { endStepId: ifThen.id },
        },
      },
      context,
    )

    expect((await reload(ifThen.id)).config.endStepId).toBe(ifThen.id)
  })

  it('preserves an existing marker through a condition edit (merge)', async () => {
    const [, ifThen, stepA] = await seedSteps([
      { key: 'newSubmission', appKey: 'formsg', type: 'trigger' },
      { key: 'ifThen', appKey: 'toolbox', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
    ])
    await ifThen.$query().patch({
      config: { endStepId: stepA.id, stepName: 'orig' },
    })

    await updateStep(
      null,
      {
        input: {
          id: ifThen.id,
          flow: flowInput(),
          key: 'ifThen',
          appKey: 'toolbox',
          connection: {},
          parameters: { conditions: [{ rows: [] }] },
        },
      },
      context,
    )

    expect((await reload(ifThen.id)).config.endStepId).toBe(stepA.id)
  })

  it('rolls back an endStepId write on a non-if-then step', async () => {
    const [, postmanStep] = await seedSteps([
      { key: 'newSubmission', appKey: 'formsg', type: 'trigger' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
    ])

    await expect(
      updateStep(
        null,
        {
          input: {
            id: postmanStep.id,
            flow: flowInput(),
            key: 'sendTransactionalEmail',
            appKey: 'postman',
            connection: {},
            parameters: {},
            config: { endStepId: postmanStep.id },
          },
        },
        context,
      ),
    ).rejects.toThrow()

    expect((await reload(postmanStep.id)).config.endStepId).toBeUndefined()
  })

  it('rolls back an endStepId write on an approval-bearing if-then', async () => {
    const [, ifThen, stepA] = await seedSteps([
      { key: 'newSubmission', appKey: 'formsg', type: 'trigger' },
      {
        key: 'ifThen',
        appKey: 'toolbox',
        type: 'action',
        config: { approval: { branch: 'reject', stepId: 'someApprovalStep' } },
      },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
    ])

    await expect(
      updateStep(
        null,
        {
          input: {
            id: ifThen.id,
            flow: flowInput(),
            key: 'ifThen',
            appKey: 'toolbox',
            connection: {},
            parameters: {},
            config: { endStepId: stepA.id },
          },
        },
        context,
      ),
    ).rejects.toThrow()

    const reloaded = await reload(ifThen.id)
    expect(reloaded.config.endStepId).toBeUndefined()
    expect(reloaded.config.approval).toEqual({
      branch: 'reject',
      stepId: 'someApprovalStep',
    })
  })
})
