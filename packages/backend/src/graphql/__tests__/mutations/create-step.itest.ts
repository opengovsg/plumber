import { beforeEach, describe, expect, it } from 'vitest'

import createStep from '@/graphql/mutations/create-step'
import Flow from '@/models/flow'
import Step from '@/models/step'
import User from '@/models/user'
import Context from '@/types/express/context'

describe('createStep mutation integration tests', async () => {
  let testFlow: Flow
  let existingSteps: Step[]
  let context: Context

  // Clean up (and seed) database before each test.
  beforeEach(async () => {
    // Clear out all rows. Adjust deletion order if using foreign keys.
    await Step.query().delete()
    await Flow.query().delete()

    const testUser = await User.query().findOne({ email: 'tester@open.gov.sg' })
    context = {
      req: null,
      currentUser: testUser,
      res: null,
      isAdminOperation: false,
    }

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
})
