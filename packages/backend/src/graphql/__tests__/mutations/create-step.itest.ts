import { randomUUID } from 'crypto'
import { NotFoundError } from 'objection'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import apps from '@/apps'
import { BadUserInputError } from '@/errors/graphql-errors'
import createStep from '@/graphql/mutations/create-step'
import Flow from '@/models/flow'
import FlowConnections from '@/models/flow-connections'
import Step from '@/models/step'
import User from '@/models/user'
import Context from '@/types/express/context'

import { generateMockCollaborator, generateMockUser } from './flow.mock'

const REFRESH_PIPE_MESSAGE =
  'This Pipe has been edited by another user. Please refresh the page to see the latest changes and try again.'

describe('createStep mutation integration tests', async () => {
  let testFlow: Flow
  let existingSteps: Step[]
  let context: Context
  let owner: User
  let editor: User
  let viewer: User
  let nonCollaborator: User
  let testConnection: any
  let testFlowTimestampString: string
  let genericNewStepParams: {
    input: {
      flow: { id: string; updatedAt: string }
      previousStep: { id: string }
      key: string
      appKey: string
      parameters: Record<string, any>
    }
  }

  // Clean up (and seed) database before each test.
  beforeEach(async () => {
    vi.resetAllMocks()

    // Clear out all rows. Adjust deletion order if using foreign keys.
    await FlowConnections.query().delete()
    await Step.query().delete()
    await Flow.query().delete()

    const testUser = await User.query().findOne({ email: 'tester@open.gov.sg' })
    context = {
      req: null,
      currentUser: testUser,
      res: null,
      isAdminOperation: false,
    }
    owner = testUser

    // Create a test connection
    testConnection = await testUser
      .$relatedQuery('connections')
      .insertAndFetch({
        key: 'postman',
        formattedData: { test: 'data' },
        verified: true,
        draft: false,
      })

    // Create a flow associated with the test user.
    testFlow = await testUser.$relatedQuery('flows').insertAndFetch({
      name: 'Test Flow',
      // additional flow properties as needed
      updatedBy: owner.id,
    })
    testFlowTimestampString = String(new Date(testFlow.updatedAt).getTime())

    // Mock the patchLastUpdated method to return proper flow data
    vi.spyOn(Flow.prototype, 'patchLastUpdated').mockResolvedValue({
      ...testFlow,
      updatedAt: testFlow.updatedAt,
    } as any)

    editor = await generateMockUser('editor')
    viewer = await generateMockUser('viewer')
    nonCollaborator = await generateMockUser('nonCollaborator')

    await generateMockCollaborator(testFlow.id, editor.id, owner.id, 'editor')
    await generateMockCollaborator(testFlow.id, viewer.id, owner.id, 'viewer')
    await FlowConnections.addFlowConnection({
      flowId: testFlow.id,
      connectionId: testConnection.id,
      addedBy: owner.id,
      connectionType: 'connection',
    })

    // Create a "previous" step in the flow with position 1.
    existingSteps = await testFlow.$relatedQuery('steps').insertAndFetch([
      {
        key: 'newSubmission',
        appKey: 'formsg',
        type: 'trigger',
        position: 1,
        parameters: { foo: 'bar' },
      },
      {
        key: 'key',
        appKey: 'appKey',
        type: 'action',
        position: 2,
        connectionId: testConnection.id,
        parameters: {},
      },
      {
        key: 'key',
        appKey: 'appKey',
        type: 'action',
        position: 3,
        parameters: {},
      },
    ])

    genericNewStepParams = {
      input: {
        flow: {
          id: testFlow.id,
          updatedAt: testFlowTimestampString,
        },
        previousStep: { id: existingSteps[0].id },
        key: 'sendTransactionalEmail',
        appKey: 'postman',
        parameters: { newParam: 'value' },
      },
    }
  })

  it('creates a new step correctly and shift later steps down', async () => {
    const params = {
      input: {
        flow: {
          id: testFlow.id,
          updatedAt: testFlowTimestampString,
        },
        previousStep: { id: existingSteps[0].id },
        key: 'sendMessage',
        appKey: 'telegram-bot',
        parameters: { newParam: 'value' },
      },
    }

    const newStep = await createStep(null, params, context)

    // Ensure the new step is returned as expected.
    expect(newStep).toBeDefined()
    expect(newStep.type).toBe('action')
    expect(newStep.key).toBe('sendMessage')
    expect(newStep.appKey).toBe('telegram-bot')
    // New step's position should be previousStep.position + 1.
    expect(newStep.position).toBe(existingSteps[0].position + 1)

    // Verify overall that there are three steps related to the flow.
    const steps = await testFlow
      .$relatedQuery('steps')
      .orderBy('position', 'asc')
    expect(steps).toHaveLength(4)
    expect(steps.map((step) => step.id)).toEqual([
      existingSteps[0].id,
      newStep.id,
      existingSteps[1].id,
      existingSteps[2].id,
    ])
    // Also, check the ordering.
    expect(steps.map((step) => step.position)).toEqual([1, 2, 3, 4])
  })

  it('should not shift steps if the previous step is the last step', async () => {
    const params = {
      input: {
        flow: {
          id: testFlow.id,
          updatedAt: testFlowTimestampString,
        },
        previousStep: { id: existingSteps[2].id },
      },
    }

    const newStep = await createStep(null, params, context)

    expect(newStep).toBeDefined()
    expect(newStep.position).toBe(existingSteps[2].position + 1)
    const steps = await testFlow
      .$relatedQuery('steps')
      .orderBy('position', 'asc')
    expect(steps).toHaveLength(4)
    expect(steps.map((step) => step.id)).toEqual([
      existingSteps[0].id,
      existingSteps[1].id,
      existingSteps[2].id,
      newStep.id,
    ])
    // Also, check the ordering.
    expect(steps.map((step) => step.position)).toEqual([1, 2, 3, 4])
  })

  it('should call patchLastUpdated when creating a step', async () => {
    const patchLastUpdatedSpy = vi.spyOn(Flow.prototype, 'patchLastUpdated')

    const params = {
      input: {
        flow: {
          id: testFlow.id,
          updatedAt: testFlowTimestampString,
        },
        previousStep: { id: existingSteps[2].id },
      },
    }
    await createStep(null, params, context)
    expect(patchLastUpdatedSpy).toHaveBeenCalledTimes(1)
  })

  it('throws an error if the flow does not belong to the current user', async () => {
    // Create another user who does not own the existing flow.
    const otherUser = await User.query().insertAndFetch({
      email: 'other@example.com',
    })

    context.currentUser = otherUser

    const params = {
      input: {
        flow: {
          id: testFlow.id,
          updatedAt: testFlowTimestampString,
        },
        previousStep: { id: existingSteps[0].id },
        key: 'key',
        appKey: 'appKey',
        parameters: {},
      },
    }

    await expect(createStep(null, params, context)).rejects.toThrow()
  })

  it('throws an error if the previous step is not found', async () => {
    const params = {
      input: {
        flow: {
          id: testFlow.id,
          updatedAt: testFlowTimestampString,
        },
        previousStep: { id: 'invalid-id' }, // Non-existent step id
        key: 'sendTransactionalEmail',
        appKey: 'postman',
        parameters: { newParam: 'value' },
      },
    }

    await expect(createStep(null, params, context)).rejects.toThrow()
  })

  it('owner can create a new step', async () => {
    const newStep = await createStep(null, genericNewStepParams, context)

    expect(newStep).toBeDefined()
    expect(newStep.type).toBe('action')
    expect(newStep.key).toBe('sendTransactionalEmail')
    expect(newStep.appKey).toBe('postman')
    // New step's position should be previousStep.position + 1.
    expect(newStep.position).toBe(existingSteps[0].position + 1)
  })

  it('editor can create a new step', async () => {
    context.currentUser = editor
    const newStep = await createStep(null, genericNewStepParams, context)

    expect(newStep).toBeDefined()
    expect(newStep.type).toBe('action')
    expect(newStep.key).toBe('sendTransactionalEmail')
    expect(newStep.appKey).toBe('postman')
    // New step's position should be previousStep.position + 1.
    expect(newStep.position).toBe(existingSteps[0].position + 1)
  })

  it('editor can create a new step with owner connection', async () => {
    context.currentUser = editor

    const params = {
      input: {
        flow: { id: testFlow.id, updatedAt: testFlowTimestampString },
        previousStep: { id: existingSteps[0].id },
        key: 'sendTransactionalEmail',
        appKey: 'postman',
        parameters: { newParam: 'value' },
        connection: { id: testConnection.id },
        connectionRole: 'owner',
      },
    }

    const newStep = await createStep(null, params, context)
    expect(newStep).toBeDefined()
    expect(newStep.type).toBe('action')
    expect(newStep.key).toBe('sendTransactionalEmail')
    expect(newStep.appKey).toBe('postman')
    expect(newStep.position).toBe(existingSteps[0].position + 1)
  })

  it('viewer should not be able to create a new step', async () => {
    context.currentUser = viewer
    await expect(
      createStep(null, genericNewStepParams, context),
    ).rejects.toThrow(NotFoundError)
  })

  it('non-collaborator should not be able to create a new step', async () => {
    context.currentUser = nonCollaborator
    await expect(
      createStep(null, genericNewStepParams, context),
    ).rejects.toThrow(NotFoundError)
  })

  it('creates a step with connection and adds flow connection for owner', async () => {
    context.currentUser = owner
    const params = {
      input: {
        flow: {
          id: testFlow.id,
          updatedAt: testFlowTimestampString,
        },
        previousStep: { id: existingSteps[0].id },
        key: 'sendTransactionalEmail',
        appKey: 'postman',
        parameters: { newParam: 'value' },
        connection: { id: testConnection.id },
      },
    }

    const newStep = await createStep(null, params, context)

    expect(newStep).toBeDefined()
    expect((newStep as any).connectionId).toBe(testConnection.id)

    // Verify flow connection was added
    const flowConnection = await FlowConnections.query().findOne({
      flow_id: testFlow.id,
      connection_id: testConnection.id,
      added_by: owner.id,
    })
    expect(flowConnection).toBeDefined()
  })

  it('throws error when connection does not exist', async () => {
    const params = {
      input: {
        flow: {
          id: testFlow.id,
          updatedAt: testFlowTimestampString,
        },
        previousStep: { id: existingSteps[0].id },
        key: 'sendTransactionalEmail',
        appKey: 'postman',
        parameters: { newParam: 'value' },
        connection: { id: randomUUID() },
      },
    }

    await expect(createStep(null, params, context)).rejects.toThrow(
      NotFoundError,
    )
  })

  // TODO (kevinkim-ogp): update this test when we allow editors to add their own connections to the Pipe
  it('should not add step if connection is not owned by the owner', async () => {
    context.currentUser = owner

    const editorConnection = await editor
      .$relatedQuery('connections')
      .insertAndFetch({
        key: 'editor-connection',
        formattedData: { test: 'data' },
        verified: true,
        draft: false,
      })

    const params = {
      input: {
        flow: {
          id: testFlow.id,
          updatedAt: testFlowTimestampString,
        },
        previousStep: { id: existingSteps[0].id },
        key: 'sendTransactionalEmail',
        appKey: 'postman',
        parameters: { newParam: 'value' },
        connection: { id: editorConnection.id },
      },
    }

    await expect(createStep(null, params, context)).rejects.toThrow(
      NotFoundError,
    )
  })

  it('throws error when user does not have access to connection', async () => {
    // Create a connection owned by another user
    const otherUser = await User.query().insertAndFetch({
      email: 'other@example.com',
    })
    const otherUserConnection = await otherUser
      .$relatedQuery('connections')
      .insertAndFetch({
        key: 'other-connection',
        formattedData: { test: 'data' },
        verified: true,
      })

    const params = {
      input: {
        flow: {
          id: testFlow.id,
          updatedAt: testFlowTimestampString,
        },
        previousStep: { id: existingSteps[0].id },
        key: 'sendTransactionalEmail',
        appKey: 'postman',
        parameters: { newParam: 'value' },
        connection: { id: otherUserConnection.id },
      },
    }

    await expect(createStep(null, params, context)).rejects.toThrow(
      NotFoundError,
    )
  })

  it('creates a step without connection when connection is not provided', async () => {
    const params = {
      input: {
        flow: {
          id: testFlow.id,
          updatedAt: testFlowTimestampString,
        },
        previousStep: { id: existingSteps[0].id },
        key: 'sendTransactionalEmail',
        appKey: 'postman',
        parameters: { newParam: 'value' },
      },
    }

    const newStep = await createStep(null, params, context)

    expect(newStep).toBeDefined()
    expect((newStep as any).connectionId).toBeNull()
  })

  describe('version assignment', () => {
    it('defaults to version 1 when app has no stepTransformer', async () => {
      // postman has no stepTransformer - version should default to 1
      const newStep = await createStep(
        null,
        {
          input: {
            flow: { id: testFlow.id, updatedAt: testFlowTimestampString },
            previousStep: { id: existingSteps[0].id },
            key: 'sendTransactionalEmail',
            appKey: 'postman',
            parameters: {},
          },
        },
        context,
      )

      expect((newStep as any).version).toBe(1)
    })

    it('defaults to version 1 when no appKey is provided', async () => {
      const newStep = await createStep(
        null,
        {
          input: {
            flow: { id: testFlow.id, updatedAt: testFlowTimestampString },
            previousStep: { id: existingSteps[2].id },
          },
        },
        context,
      )

      expect((newStep as any).version).toBe(1)
    })

    it('uses the version from stepTransformer.getLatestStepVersion when app has a stepTransformer', async () => {
      const mockGetLatestStepVersion = vi.fn().mockReturnValue(3)
      const originalPostman = (apps as any)['postman']
      apps['postman'] = {
        ...originalPostman,
        stepTransformer: {
          getLatestStepVersion: mockGetLatestStepVersion,
          transformStepParameters: vi.fn(),
        },
      }

      try {
        const newStep = await createStep(
          null,
          {
            input: {
              flow: { id: testFlow.id, updatedAt: testFlowTimestampString },
              previousStep: { id: existingSteps[0].id },
              key: 'sendTransactionalEmail',
              appKey: 'postman',
              parameters: {},
            },
          },
          context,
        )

        expect(mockGetLatestStepVersion).toHaveBeenCalledWith(
          'sendTransactionalEmail',
        )
        expect((newStep as any).version).toBe(3)
      } finally {
        ;(apps as any)['postman'] = originalPostman
      }
    })
  })

  describe('updatedAt and updatedBy validation', () => {
    it('should succeed when input.flow.updatedAt matches flow.updatedAt (timestamp string)', async () => {
      const params = {
        input: {
          flow: {
            id: testFlow.id,
            updatedAt: testFlowTimestampString,
          },
          previousStep: { id: existingSteps[0].id },
          key: 'sendTransactionalEmail',
          appKey: 'postman',
          parameters: { newParam: 'value' },
        },
      }

      const newStep = await createStep(null, params, context)

      expect(newStep).toBeDefined()
      expect(newStep.key).toBe('sendTransactionalEmail')
    })

    it('should succeed when input.flow.updatedAt is different from flow.updatedAt for same user', async () => {
      const futureTimestamp = (
        new Date(testFlow.updatedAt).getTime() + 1000
      ).toString()
      const params = {
        input: {
          flow: {
            id: testFlow.id,
            updatedAt: futureTimestamp,
          },
          previousStep: { id: existingSteps[0].id },
          key: 'sendTransactionalEmail',
          appKey: 'postman',
          parameters: { newParam: 'value' },
        },
      }

      const newStep = await createStep(null, params, context)

      expect(newStep).toBeDefined()
      expect(newStep.key).toBe('sendTransactionalEmail')
    })

    it('should throw when input.flow.updatedAt is different from flow.updatedAt for different user', async () => {
      const futureTimestamp = (
        new Date(testFlow.updatedAt).getTime() + 1000
      ).toString()
      context.currentUser = editor
      const params = {
        input: {
          flow: {
            id: testFlow.id,
            updatedAt: futureTimestamp,
          },
          previousStep: { id: existingSteps[0].id },
          key: 'sendTransactionalEmail',
          appKey: 'postman',
          parameters: { newParam: 'value' },
        },
      }

      await expect(createStep(null, params, context)).rejects.toThrow(
        BadUserInputError,
      )
      await expect(createStep(null, params, context)).rejects.toThrow(
        REFRESH_PIPE_MESSAGE,
      )
    })

    it('should throw when input.flow.updatedAt is older than flow.updatedAt for different user', async () => {
      const oldTimestamp = (
        new Date(testFlow.updatedAt).getTime() - 5000
      ).toString()
      context.currentUser = editor
      const params = {
        input: {
          flow: {
            id: testFlow.id,
            updatedAt: oldTimestamp,
          },
          previousStep: { id: existingSteps[0].id },
          key: 'sendTransactionalEmail',
          appKey: 'postman',
          parameters: { newParam: 'value' },
        },
      }

      await expect(createStep(null, params, context)).rejects.toThrow(
        BadUserInputError,
      )
      await expect(createStep(null, params, context)).rejects.toThrow(
        REFRESH_PIPE_MESSAGE,
      )
    })

    it('should not throw when input.flow.updatedAt is an invalid timestamp string', async () => {
      const params = {
        input: {
          flow: {
            id: testFlow.id,
            updatedAt: 'invalid-timestamp',
          },
          previousStep: { id: existingSteps[0].id },
          key: 'sendTransactionalEmail',
          appKey: 'postman',
          parameters: { newParam: 'value' },
        },
      }

      const newStep = await createStep(null, params, context)

      expect(newStep).toBeDefined()
      expect(newStep.key).toBe('sendTransactionalEmail')
    })
  })
})

describe('createStep endStepId write rules', () => {
  let testFlow: Flow
  let owner: User
  let context: Context
  let flowTimestamp: string

  const flowInput = () => ({ id: testFlow.id, updatedAt: flowTimestamp })

  // Inserts steps in the given order (trigger first) and returns them.
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
    vi.resetAllMocks()
    await FlowConnections.query().delete()
    await Step.query().delete()
    await Flow.query().delete()

    owner = await User.query().findOne({ email: 'tester@open.gov.sg' })
    context = {
      req: null,
      currentUser: owner,
      res: null,
      isAdminOperation: false,
    } as unknown as Context

    testFlow = await owner.$relatedQuery('flows').insertAndFetch({
      name: 'endStep Test Flow',
      updatedBy: owner.id,
    })
    flowTimestamp = String(new Date(testFlow.updatedAt).getTime())

    vi.spyOn(Flow.prototype, 'patchLastUpdated').mockResolvedValue({
      ...testFlow,
      updatedAt: testFlow.updatedAt,
    } as any)
  })

  it('rule 1: pins a legacy block when adding after it (lazy upgrade)', async () => {
    // trigger, ifThenA, stepA, ifThenB, stepB — all legacy.
    const [, ifThenA, stepA] = await seedSteps([
      { key: 'newSubmission', appKey: 'formsg', type: 'trigger' },
      { key: 'ifThen', appKey: 'toolbox', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
      { key: 'ifThen', appKey: 'toolbox', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
    ])

    const newStep = await createStep(
      null,
      {
        input: {
          flow: flowInput(),
          previousStep: { id: stepA.id },
          previousBlockId: ifThenA.id,
          key: 'sendTransactionalEmail',
          appKey: 'postman',
          parameters: {},
        },
      },
      context,
    )

    // The legacy block is pinned to its derived endStep (stepA)...
    expect((await reload(ifThenA.id)).config.endStepId).toBe(stepA.id)
    // ...and the new step lands OUTSIDE the block (right after stepA).
    expect(newStep.position).toBe(stepA.position + 1)
    expect((newStep as any).config.endStepId).toBeUndefined()
  })

  it('rule 1: adds after an explicit block without changing its marker', async () => {
    // trigger, ifThenA (explicit -> stepA), stepA, other.
    const seeded = await seedSteps([
      { key: 'newSubmission', appKey: 'formsg', type: 'trigger' },
      { key: 'ifThen', appKey: 'toolbox', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
    ])
    const [, ifThenA, stepA, other] = seeded
    await ifThenA.$query().patch({ config: { endStepId: stepA.id } })

    const newStep = await createStep(
      null,
      {
        input: {
          flow: flowInput(),
          previousStep: { id: stepA.id },
          previousBlockId: ifThenA.id,
          key: 'sendTransactionalEmail',
          appKey: 'postman',
          parameters: {},
        },
      },
      context,
    )

    // Marker unchanged; new step lands outside; `other` shifts down.
    expect((await reload(ifThenA.id)).config.endStepId).toBe(stepA.id)
    expect(newStep.position).toBe(stepA.position + 1)
    expect((await reload(other.id)).position).toBe(newStep.position + 1)
  })

  it('rule 1: rolls back when previousStep is not the block endStep', async () => {
    const seeded = await seedSteps([
      { key: 'newSubmission', appKey: 'formsg', type: 'trigger' },
      { key: 'ifThen', appKey: 'toolbox', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
    ])
    const [, ifThenA, stepA, other] = seeded
    await ifThenA.$query().patch({ config: { endStepId: stepA.id } })

    await expect(
      createStep(
        null,
        {
          input: {
            flow: flowInput(),
            // `other` is NOT the block's endStep -> bug tripwire.
            previousStep: { id: other.id },
            previousBlockId: ifThenA.id,
            key: 'sendTransactionalEmail',
            appKey: 'postman',
            parameters: {},
          },
        },
        context,
      ),
    ).rejects.toThrow()

    // Nothing created (rollback).
    const steps = await testFlow.$relatedQuery('steps')
    expect(steps).toHaveLength(4)
  })

  it('rule 1: rolls back when the block would reach out of its rejection branch', async () => {
    // The derived extent of a rejection-branch block runs to the end of the
    // flow, which here leaves the branch — that block may not be pinned.
    const seeded = await seedSteps([
      { key: 'newSubmission', appKey: 'formsg', type: 'trigger' },
      {
        key: 'ifThen',
        appKey: 'toolbox',
        type: 'action',
        config: { approval: { branch: 'reject', stepId: 'someApprovalStep' } },
      },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
    ])
    const [, ifThenApproval, stepA] = seeded

    await expect(
      createStep(
        null,
        {
          input: {
            flow: flowInput(),
            previousStep: { id: stepA.id },
            previousBlockId: ifThenApproval.id,
            key: 'sendTransactionalEmail',
            appKey: 'postman',
            parameters: {},
          },
        },
        context,
      ),
    ).rejects.toThrow()

    const steps = await testFlow.$relatedQuery('steps')
    expect(steps).toHaveLength(3)
  })

  it('rule 1: pins a rejection-branch block when adding after it', async () => {
    // trigger, mrf, [ifThenA, stepA], ifThenB — the last two if-thens bound
    // ifThenA's derived extent to stepA, which stays inside the branch.
    const rejection = {
      approval: { branch: 'reject' as const, stepId: 'someApprovalStep' },
    }
    const [, , ifThenA, stepA] = await seedSteps([
      { key: 'newSubmission', appKey: 'formsg', type: 'trigger' },
      { key: 'mrfSubmission', appKey: 'formsg', type: 'action' },
      { key: 'ifThen', appKey: 'toolbox', type: 'action', config: rejection },
      {
        key: 'sendTransactionalEmail',
        appKey: 'postman',
        type: 'action',
        config: rejection,
      },
      { key: 'ifThen', appKey: 'toolbox', type: 'action', config: rejection },
    ])

    const newStep = await createStep(
      null,
      {
        input: {
          flow: flowInput(),
          previousStep: { id: stepA.id },
          previousBlockId: ifThenA.id,
          key: 'sendTransactionalEmail',
          appKey: 'postman',
          parameters: {},
          config: rejection,
        },
      },
      context,
    )

    expect((await reload(ifThenA.id)).config.endStepId).toBe(stepA.id)
    expect(newStep.position).toBe(stepA.position + 1)
    expect((newStep as any).config.endStepId).toBeUndefined()
  })

  it('rule 2: extends an explicit block on a plain tail-add', async () => {
    const seeded = await seedSteps([
      { key: 'newSubmission', appKey: 'formsg', type: 'trigger' },
      { key: 'ifThen', appKey: 'toolbox', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
    ])
    const [, ifThenA, stepA] = seeded
    await ifThenA.$query().patch({ config: { endStepId: stepA.id } })

    const newStep = await createStep(
      null,
      {
        input: {
          flow: flowInput(),
          // No previousBlockId -> inside-tail add.
          previousStep: { id: stepA.id },
          key: 'sendTransactionalEmail',
          appKey: 'postman',
          parameters: {},
        },
      },
      context,
    )

    // Block extends to include the new step.
    expect((await reload(ifThenA.id)).config.endStepId).toBe(newStep.id)
  })

  it('rule 2: extends an empty (self-ref) block on the first inside-add', async () => {
    const seeded = await seedSteps([
      { key: 'newSubmission', appKey: 'formsg', type: 'trigger' },
      { key: 'ifThen', appKey: 'toolbox', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
    ])
    const [, ifThenA] = seeded
    // Empty block: self-ref.
    await ifThenA.$query().patch({ config: { endStepId: ifThenA.id } })

    const newStep = await createStep(
      null,
      {
        input: {
          flow: flowInput(),
          previousStep: { id: ifThenA.id },
          key: 'sendTransactionalEmail',
          appKey: 'postman',
          parameters: {},
        },
      },
      context,
    )

    expect((await reload(ifThenA.id)).config.endStepId).toBe(newStep.id)
  })

  it('rule 2: extends an empty block inside a rejection branch', async () => {
    // What the if-then V2 initializer does inside an MRF rejection branch: the
    // if-then self-references, then its first child extends the block. The
    // pre-existing step below it stays outside.
    const rejection = {
      approval: { branch: 'reject' as const, stepId: 'someApprovalStep' },
    }
    const [, , ifThenA, existing] = await seedSteps([
      { key: 'newSubmission', appKey: 'formsg', type: 'trigger' },
      { key: 'mrfSubmission', appKey: 'formsg', type: 'action' },
      { key: 'ifThen', appKey: 'toolbox', type: 'action', config: rejection },
      {
        key: 'sendTransactionalEmail',
        appKey: 'postman',
        type: 'action',
        config: rejection,
      },
    ])
    await ifThenA.$query().patch({
      config: { ...rejection, endStepId: ifThenA.id },
    })

    const newStep = await createStep(
      null,
      {
        input: {
          flow: flowInput(),
          previousStep: { id: ifThenA.id },
          key: 'sendTransactionalEmail',
          appKey: 'postman',
          parameters: {},
          config: rejection,
        },
      },
      context,
    )

    const block = await reload(ifThenA.id)
    expect(block.config.endStepId).toBe(newStep.id)
    // The marker still bounds the block, so the step that was already there is
    // not swallowed, and the branch marker survives the pin.
    expect(block.config.approval).toEqual(rejection.approval)
    expect(newStep.position).toBeLessThan((await reload(existing.id)).position)
  })

  it('rule 2: does NOT extend when the new step is an if-then', async () => {
    const seeded = await seedSteps([
      { key: 'newSubmission', appKey: 'formsg', type: 'trigger' },
      { key: 'ifThen', appKey: 'toolbox', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
    ])
    const [, ifThenA, stepA] = seeded
    await ifThenA.$query().patch({ config: { endStepId: stepA.id } })

    const newIfThen = await createStep(
      null,
      {
        input: {
          flow: flowInput(),
          previousStep: { id: stepA.id },
          key: 'ifThen',
          appKey: 'toolbox',
          parameters: {},
        },
      },
      context,
    )

    // Marker unchanged; the new if-then lands outside as its own block.
    expect((await reload(ifThenA.id)).config.endStepId).toBe(stepA.id)
    expect((newIfThen as any).config.endStepId).toBeUndefined()
  })

  it('rule 2: no-op for a mid-range insert (endStep stays last by id)', async () => {
    // Explicit block spanning stepA..stepB; insert after stepA (mid-range).
    const seeded = await seedSteps([
      { key: 'newSubmission', appKey: 'formsg', type: 'trigger' },
      { key: 'ifThen', appKey: 'toolbox', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
    ])
    const [, ifThenA, stepA, stepB] = seeded
    await ifThenA.$query().patch({ config: { endStepId: stepB.id } })

    await createStep(
      null,
      {
        input: {
          flow: flowInput(),
          previousStep: { id: stepA.id },
          key: 'sendTransactionalEmail',
          appKey: 'postman',
          parameters: {},
        },
      },
      context,
    )

    // Marker still points at stepB (now shifted, but same id).
    expect((await reload(ifThenA.id)).config.endStepId).toBe(stepB.id)
  })

  it('rule 3: no-op inside-add on a legacy block (stays lazy)', async () => {
    const seeded = await seedSteps([
      { key: 'newSubmission', appKey: 'formsg', type: 'trigger' },
      { key: 'ifThen', appKey: 'toolbox', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
      { key: 'ifThen', appKey: 'toolbox', type: 'action' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
    ])
    const [, , stepA] = seeded

    await createStep(
      null,
      {
        input: {
          flow: flowInput(),
          previousStep: { id: stepA.id },
          key: 'sendTransactionalEmail',
          appKey: 'postman',
          parameters: {},
        },
      },
      context,
    )

    // No endStepId anywhere — legacy stays lazy.
    const steps = await testFlow.$relatedQuery('steps')
    expect(steps.every((step) => step.config.endStepId === undefined)).toBe(
      true,
    )
  })

  it('strips a client-supplied config.endStepId on create', async () => {
    const seeded = await seedSteps([
      { key: 'newSubmission', appKey: 'formsg', type: 'trigger' },
      { key: 'sendTransactionalEmail', appKey: 'postman', type: 'action' },
    ])
    const [, existing] = seeded

    const newStep = await createStep(
      null,
      {
        input: {
          flow: flowInput(),
          previousStep: { id: existing.id },
          key: 'sendTransactionalEmail',
          appKey: 'postman',
          parameters: {},
          config: { endStepId: 'client-supplied-id', stepName: 'kept' },
        },
      },
      context,
    )

    expect((newStep as any).config.endStepId).toBeUndefined()
    // Other config keys survive the strip.
    expect((newStep as any).config.stepName).toBe('kept')
  })
})
