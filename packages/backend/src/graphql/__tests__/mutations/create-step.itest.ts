import { randomUUID } from 'crypto'
import { NotFoundError } from 'objection'
import { beforeEach, describe, expect, it } from 'vitest'

import { BadUserInputError } from '@/errors/graphql-errors'
import createStep from '@/graphql/mutations/create-step'
import Flow from '@/models/flow'
import FlowConnections from '@/models/flow-connections'
import Step from '@/models/step'
import User from '@/models/user'
import Context from '@/types/express/context'

describe('createStep mutation integration tests', async () => {
  let testFlow: Flow
  let existingSteps: Step[]
  let context: Context
  let owner: User
  let editor: User
  let viewer: User
  let nonCollaborator: User
  let testConnection: any
  let genericNewStepParams: {
    input: {
      flow: { id: string }
      previousStep: { id: string }
      key: string
      appKey: string
      parameters: Record<string, any>
    }
  }

  // Clean up (and seed) database before each test.
  beforeEach(async () => {
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

    // Create a test connection
    testConnection = await testUser
      .$relatedQuery('connections')
      .insertAndFetch({
        key: 'test-connection',
        formattedData: { test: 'data' },
        verified: true,
        draft: false,
      })

    // Create a flow associated with the test user.
    testFlow = await testUser.$relatedQuery('flows').insertAndFetch({
      name: 'Test Flow',
      // additional flow properties as needed
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
  })

  it('creates a new step correctly and shift later steps down', async () => {
    const params = {
      input: {
        flow: { id: testFlow.id },
        previousStep: { id: existingSteps[0].id },
        key: 'newStep',
        appKey: 'test-app',
        parameters: { newParam: 'value' },
      },
    }

    const newStep = await createStep(null, params, context)

    // Ensure the new step is returned as expected.
    expect(newStep).toBeDefined()
    expect(newStep.type).toBe('action')
    expect(newStep.key).toBe('newStep')
    expect(newStep.appKey).toBe('test-app')
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
        flow: { id: testFlow.id },
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

  it('throws an error if the flow does not belong to the current user', async () => {
    // Create another user who does not own the existing flow.
    const otherUser = await User.query().insertAndFetch({
      email: 'other@example.com',
    })

    context.currentUser = otherUser

    const params = {
      input: {
        flow: { id: testFlow.id },
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
        flow: { id: testFlow.id },
        previousStep: { id: 'invalid-id' }, // Non-existent step id
        key: 'newStep',
        appKey: 'test-app',
        parameters: { newParam: 'value' },
      },
    }

    await expect(createStep(null, params, context)).rejects.toThrow()
  })

  it('owner can create a new step', async () => {
    const newStep = await createStep(null, genericNewStepParams, context)

    expect(newStep).toBeDefined()
    expect(newStep.type).toBe('action')
    expect(newStep.key).toBe('newStep')
    expect(newStep.appKey).toBe('test-app')
    // New step's position should be previousStep.position + 1.
    expect(newStep.position).toBe(existingSteps[0].position + 1)
  })

  it('editor can create a new step', async () => {
    context.currentUser = editor
    const newStep = await createStep(null, genericNewStepParams, context)

    expect(newStep).toBeDefined()
    expect(newStep.type).toBe('action')
    expect(newStep.key).toBe('newStep')
    expect(newStep.appKey).toBe('test-app')
    // New step's position should be previousStep.position + 1.
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
        flow: { id: testFlow.id },
        previousStep: { id: existingSteps[0].id },
        key: 'newStep',
        appKey: 'test-app',
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
      user_id: owner.id,
    })
    expect(flowConnection).toBeDefined()
  })

  it('throws error when connection does not exist', async () => {
    const params = {
      input: {
        flow: { id: testFlow.id },
        previousStep: { id: existingSteps[0].id },
        key: 'newStep',
        appKey: 'test-app',
        parameters: { newParam: 'value' },
        connection: { id: randomUUID() },
      },
    }

    await expect(createStep(null, params, context)).rejects.toThrow(
      BadUserInputError,
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
        flow: { id: testFlow.id },
        previousStep: { id: existingSteps[0].id },
        key: 'newStep',
        appKey: 'test-app',
        parameters: { newParam: 'value' },
        connection: { id: editorConnection.id },
      },
    }

    await expect(createStep(null, params, context)).rejects.toThrow(
      BadUserInputError,
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
        flow: { id: testFlow.id },
        previousStep: { id: existingSteps[0].id },
        key: 'newStep',
        appKey: 'test-app',
        parameters: { newParam: 'value' },
        connection: { id: otherUserConnection.id },
      },
    }

    await expect(createStep(null, params, context)).rejects.toThrow(
      BadUserInputError,
    )
  })

  it('creates a step without connection when connection is not provided', async () => {
    const params = {
      input: {
        flow: { id: testFlow.id },
        previousStep: { id: existingSteps[0].id },
        key: 'newStep',
        appKey: 'test-app',
        parameters: { newParam: 'value' },
      },
    }

    const newStep = await createStep(null, params, context)

    expect(newStep).toBeDefined()
    expect((newStep as any).connectionId).toBeNull()
  })
})
