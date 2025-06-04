import { beforeEach, describe, expect, it } from 'vitest'

import deleteStep from '@/graphql/mutations/delete-step'
import Flow from '@/models/flow'
import Step from '@/models/step'
import User from '@/models/user'
import Context from '@/types/express/context'

import { generateMockStep } from './flow.mock'

describe('deleteStep mutation', () => {
  let context: Context
  let testFlow: Flow
  let testSteps: Step[]

  beforeEach(async () => {
    // Clear out all rows
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

    // Create test steps
    testSteps = await Promise.all([
      generateMockStep(
        context,
        'newSubmission',
        'formsg',
        'trigger',
        testFlow.id,
        1,
        { foo: 'bar' },
      ),
      generateMockStep(
        context,
        'sendTransactionalEmail',
        'postman',
        'action',
        testFlow.id,
        2,
        { email: 'test@example.com' },
      ),
      generateMockStep(
        context,
        'createTileRow',
        'tiles',
        'action',
        testFlow.id,
        3,
        {
          foo: 'bar',
        },
      ),
    ])
  })

  it('should throw error when no steps to delete', async () => {
    await expect(
      deleteStep(null, { input: { ids: [] } }, context),
    ).rejects.toThrow('Nothing to delete')
  })

  it('should throw error when steps are from different flows', async () => {
    const otherFlow = await context.currentUser
      .$relatedQuery('flows')
      .insertAndFetch({
        name: 'Test Flow 2',
        // additional flow properties as needed
      })
    const otherStep = await generateMockStep(
      context,
      'sendTransactionalEmail',
      'postman',
      'action',
      otherFlow.id,
      1,
      { email: 'test@example.com' },
    )

    await expect(
      deleteStep(
        null,
        { input: { ids: [testSteps[0].id, otherStep.id] } },
        context,
      ),
    ).rejects.toThrow('All steps to be deleted must be from the same pipe!')
  })

  it('should delete a single trigger step and create a new one', async () => {
    await deleteStep(null, { input: { ids: [testSteps[0].id] } }, context)

    // Verify the trigger step was deleted and a new one was created
    const steps = await testFlow
      .$relatedQuery('steps')
      .orderBy('position', 'asc')
    expect(steps).toHaveLength(3) // Original 3 steps
    expect(steps[0].type).toBe('trigger')
    expect(steps[0].key).toBeNull()
    expect(steps[0].appKey).toBeNull()
    expect(steps[0].parameters).toEqual({})
  })

  it('should delete contiguous action steps and update positions', async () => {
    await deleteStep(
      null,
      { input: { ids: [testSteps[1].id, testSteps[2].id] } },
      context,
    )

    // Verify the action steps were deleted and positions were updated
    const steps = await testFlow
      .$relatedQuery('steps')
      .orderBy('position', 'asc')
    expect(steps).toHaveLength(1) // Only trigger step remains
    expect(steps[0].type).toBe('trigger')
    expect(steps[0].position).toBe(1)
  })

  it('should throw error when trying to delete non-contiguous action steps', async () => {
    // Create another step after the third step
    const fourthStep = await generateMockStep(
      context,
      'sendTransactionalEmail',
      'postman',
      'action',
      testFlow.id,
      4,
      { email: 'test@example.com' },
    )

    await expect(
      deleteStep(
        null,
        { input: { ids: [testSteps[1].id, fourthStep.id] } },
        context,
      ),
    ).rejects.toThrow('Must delete contiguous action steps!')
  })

  it('should invalidate steps that reference deleted steps', async () => {
    // Create a step that references the second step
    const referencingStep = await generateMockStep(
      context,
      'sendTransactionalEmail',
      'postman',
      'action',
      testFlow.id,
      4,
      { subject: `some subject {{step.${testSteps[1].id}.foo}}` },
    )

    await deleteStep(null, { input: { ids: [testSteps[1].id] } }, context)

    // Verify the referencing step was invalidated
    const invalidatedStep = await Step.query().findById(referencingStep.id)
    expect(invalidatedStep.status).toBe('incomplete')
  })
})
