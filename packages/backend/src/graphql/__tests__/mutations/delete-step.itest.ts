import { NotFoundError } from 'objection'
import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest'

import deleteStep from '@/graphql/mutations/delete-step'
import logger from '@/helpers/logger'
import Flow from '@/models/flow'
import Step from '@/models/step'
import User from '@/models/user'
import Context from '@/types/express/context'

import { generateMockContext } from './tiles/table.mock'
import {
  generateMockCollaborator,
  generateMockStep,
  generateMockUser,
} from './flow.mock'

// Defaults to false in beforeEach below so pre-existing tests here stay
// byte-identical. The opportunistic-upgrade tests override it per case.
const mocks = vi.hoisted(() => ({
  getLdFlagValue: vi.fn(),
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getLdFlagValue: mocks.getLdFlagValue,
}))

describe('deleteStep mutation', () => {
  let context: Context
  let testFlow: Flow
  let testSteps: Step[]
  let owner: User
  let editor: User
  let viewer: User
  let nonCollaborator: User
  let defaultFlowInput: { flow: { updatedAt: string } }
  const patchLastUpdatedSpy = vi.fn().mockResolvedValue({})

  beforeEach(async () => {
    vi.resetAllMocks()
    mocks.getLdFlagValue.mockResolvedValue(false)

    // Mock the patchLastUpdated method
    vi.spyOn(Flow.prototype, 'patchLastUpdated').mockImplementation(
      patchLastUpdatedSpy,
    )

    // Clear out all rows
    await Step.query().delete()
    await Flow.query().delete()

    context = await generateMockContext()

    owner = context.currentUser
    editor = await generateMockUser('editor')
    viewer = await generateMockUser('viewer')
    nonCollaborator = await generateMockUser('nonCollaborator')

    // Create a flow associated with the test user.
    testFlow = await owner.$relatedQuery('flows').insertAndFetch({
      name: 'Test Flow',
      // additional flow properties as needed
    })
    defaultFlowInput = { flow: { updatedAt: testFlow.updatedAt } }

    await generateMockCollaborator(testFlow.id, editor.id, owner.id, 'editor')
    await generateMockCollaborator(testFlow.id, viewer.id, owner.id, 'viewer')

    // Create test steps
    testSteps = await Promise.all([
      generateMockStep(
        context,
        'catchRawWebhook',
        'custom-api',
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
      deleteStep(null, { input: { ids: [], ...defaultFlowInput } }, context),
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
        {
          input: { ids: [testSteps[0].id, otherStep.id], ...defaultFlowInput },
        },
        context,
      ),
    ).rejects.toThrow('All steps to be deleted must be from the same pipe!')
  })

  it('should delete a single trigger step and create a new one', async () => {
    await deleteStep(
      null,
      { input: { ids: [testSteps[0].id], ...defaultFlowInput } },
      context,
    )

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
      {
        input: { ids: [testSteps[1].id, testSteps[2].id], ...defaultFlowInput },
      },
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
        {
          input: { ids: [testSteps[1].id, fourthStep.id], ...defaultFlowInput },
        },
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

    await deleteStep(
      null,
      { input: { ids: [testSteps[1].id], ...defaultFlowInput } },
      context,
    )

    // Verify the referencing step was invalidated
    const invalidatedStep = await Step.query().findById(referencingStep.id)
    expect(invalidatedStep.status).toBe('incomplete')
  })

  it('should call patchLastUpdated when deleting trigger step', async () => {
    await deleteStep(
      null,
      { input: { ids: [testSteps[0].id], ...defaultFlowInput } },
      context,
    )
    expect(patchLastUpdatedSpy).toHaveBeenCalledTimes(1)
  })

  it('should call patchLastUpdated when deleting action steps', async () => {
    await deleteStep(
      null,
      {
        input: { ids: [testSteps[1].id, testSteps[2].id], ...defaultFlowInput },
      },
      context,
    )
    expect(patchLastUpdatedSpy).toHaveBeenCalledTimes(1)
  })

  it('should allow owner to delete steps', async () => {
    await deleteStep(
      null,
      { input: { ids: [testSteps[1].id], ...defaultFlowInput } },
      context,
    )
    const steps = await testFlow
      .$relatedQuery('steps')
      .orderBy('position', 'asc')

    expect(steps).toHaveLength(2)
    expect(steps[0].type).toBe('trigger')
    expect(steps[0].position).toBe(1)
  })

  it('should allow editor to delete steps', async () => {
    context.currentUser = editor
    await deleteStep(
      null,
      { input: { ids: [testSteps[1].id], ...defaultFlowInput } },
      context,
    )
    const steps = await testFlow
      .$relatedQuery('steps')
      .orderBy('position', 'asc')

    expect(steps).toHaveLength(2)
    expect(steps[0].type).toBe('trigger')
    expect(steps[0].position).toBe(1)
  })

  it('should not allow non-collaborator to delete steps', async () => {
    context.currentUser = nonCollaborator
    await expect(
      deleteStep(
        null,
        { input: { ids: [testSteps[0].id], ...defaultFlowInput } },
        context,
      ),
    ).rejects.toThrow(NotFoundError)

    const steps = await testFlow
      .$relatedQuery('steps')
      .orderBy('position', 'asc')

    expect(steps).toHaveLength(3)
  })

  it('should not allow viewer to delete steps', async () => {
    context.currentUser = viewer
    await expect(
      deleteStep(
        null,
        { input: { ids: [testSteps[0].id], ...defaultFlowInput } },
        context,
      ),
    ).rejects.toThrow(NotFoundError)
  })

  describe('new-style if-then block expansion and marker repair', () => {
    let blockFlow: Flow
    let blockFlowInput: { flow: { updatedAt: string } }
    let loggerErrorSpy: MockInstance

    const addTrigger = (
      key: 'catchRawWebhook' | 'newSubmission',
      appKey: 'custom-api' | 'formsg',
    ) =>
      generateMockStep(context, key, appKey, 'trigger', blockFlow.id, 1, {}, {})

    const addIfThen = (position: number, config: Record<string, any> = {}) =>
      generateMockStep(
        context,
        'ifThen',
        'toolbox',
        'action',
        blockFlow.id,
        position,
        { depth: '0' },
        config,
      )

    const addPlain = (position: number, config: Record<string, any> = {}) =>
      generateMockStep(
        context,
        'sendTransactionalEmail',
        'postman',
        'action',
        blockFlow.id,
        position,
        { email: 'test@example.com' },
        config,
      )

    const currentSteps = () =>
      blockFlow.$relatedQuery('steps').orderBy('position', 'asc')

    beforeEach(async () => {
      loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => null)
      blockFlow = await owner.$relatedQuery('flows').insertAndFetch({
        name: 'Block Flow',
      })
      blockFlowInput = { flow: { updatedAt: blockFlow.updatedAt } }
    })

    it('deletes the whole block when only the marked if-then id is sent', async () => {
      await addTrigger('catchRawWebhook', 'custom-api')
      const s4 = await addPlain(4)
      const ifThen = await addIfThen(2, { endStepId: s4.id })
      await addPlain(3)
      const after = await addPlain(5)

      await deleteStep(
        null,
        { input: { ids: [ifThen.id], ...blockFlowInput } },
        context,
      )

      const steps = await currentSteps()
      expect(steps.map((s) => s.id)).toEqual([
        steps[0].id, // trigger
        after.id,
      ])
      expect(steps[1].position).toBe(2)
    })

    it('is a no-op double-delete when the full range is sent (old-UI branch delete)', async () => {
      await addTrigger('catchRawWebhook', 'custom-api')
      const s3 = await addPlain(3)
      const s4 = await addPlain(4)
      const ifThen = await addIfThen(2, { endStepId: s4.id })
      const after = await addPlain(5)

      await deleteStep(
        null,
        {
          input: { ids: [ifThen.id, s3.id, s4.id], ...blockFlowInput },
        },
        context,
      )

      const steps = await currentSteps()
      expect(steps.map((s) => s.id)).toEqual([steps[0].id, after.id])
    })

    it('never expands a legacy (marker-less) if-then', async () => {
      await addTrigger('catchRawWebhook', 'custom-api')
      const legacy = await addIfThen(2) // no endStepId marker
      const s3 = await addPlain(3)
      const s4 = await addPlain(4)

      await deleteStep(
        null,
        { input: { ids: [legacy.id], ...blockFlowInput } },
        context,
      )

      // Only the if-then is deleted. The following steps keep old-client
      // single-id delete semantics.
      const steps = await currentSteps()
      expect(steps.map((s) => s.id)).toEqual([steps[0].id, s3.id, s4.id])
    })

    it('repoints a surviving block to its new highest member when the endStep is deleted', async () => {
      await addTrigger('catchRawWebhook', 'custom-api')
      const s3 = await addPlain(3)
      const s4 = await addPlain(4)
      const ifThen = await addIfThen(2, { endStepId: s4.id })

      await deleteStep(
        null,
        { input: { ids: [s4.id], ...blockFlowInput } },
        context,
      )

      const steps = await currentSteps()
      const repaired = steps.find((s) => s.id === ifThen.id)
      expect(repaired?.config.endStepId).toBe(s3.id)
    })

    it('empties a block to self-reference when its only member is deleted', async () => {
      await addTrigger('catchRawWebhook', 'custom-api')
      const s3 = await addPlain(3)
      const ifThen = await addIfThen(2, { endStepId: s3.id })

      await deleteStep(
        null,
        { input: { ids: [s3.id], ...blockFlowInput } },
        context,
      )

      const steps = await currentSteps()
      const repaired = steps.find((s) => s.id === ifThen.id)
      expect(repaired?.config.endStepId).toBe(ifThen.id)
    })

    it('does not expand a dangling marker and logs it', async () => {
      await addTrigger('catchRawWebhook', 'custom-api')
      const s3 = await addPlain(3)
      const ifThen = await addIfThen(2, { endStepId: 'does-not-exist' })

      await deleteStep(
        null,
        { input: { ids: [ifThen.id], ...blockFlowInput } },
        context,
      )

      // Only the if-then is deleted; its member survives.
      const steps = await currentSteps()
      expect(steps.map((s) => s.id)).toEqual([steps[0].id, s3.id])
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'if-then-dangling-end-step',
          mutation: 'deleteStep',
          ifThenStepId: ifThen.id,
        }),
      )
    })

    it('preserves an intact block marker when the trigger (MRF) branch is deleted', async () => {
      const trigger = await addTrigger('newSubmission', 'formsg')
      const s3 = await addPlain(3)
      const ifThen = await addIfThen(2, { endStepId: s3.id })
      // An MRF submission step outside the block, removed by removeMrfSteps.
      await generateMockStep(
        context,
        'mrfSubmission',
        'formsg',
        'action',
        blockFlow.id,
        4,
        {},
        {},
      )

      await deleteStep(
        null,
        { input: { ids: [trigger.id], ...blockFlowInput } },
        context,
      )

      // removeMrfSteps drops the mrfSubmission step. The block's marker is
      // repaired over the survivor set and stays intact since its endStep
      // survived.
      const steps = await currentSteps()
      const repaired = steps.find((s) => s.id === ifThen.id)
      expect(repaired?.config.endStepId).toBe(s3.id)
      expect(steps.some((s) => s.key === 'mrfSubmission')).toBe(false)
    })
  })

  describe('opportunistic if-then V1 upgrade', () => {
    let blockFlow: Flow
    let blockFlowInput: { flow: { updatedAt: string } }

    const addTrigger = (
      key: 'catchRawWebhook' | 'newSubmission',
      appKey: 'custom-api' | 'formsg',
    ) =>
      generateMockStep(context, key, appKey, 'trigger', blockFlow.id, 1, {}, {})

    const addIfThen = (position: number, config: Record<string, any> = {}) =>
      generateMockStep(
        context,
        'ifThen',
        'toolbox',
        'action',
        blockFlow.id,
        position,
        { depth: '0' },
        config,
      )

    const addPlain = (position: number, config: Record<string, any> = {}) =>
      generateMockStep(
        context,
        'sendTransactionalEmail',
        'postman',
        'action',
        blockFlow.id,
        position,
        { email: 'test@example.com' },
        config,
      )

    const currentSteps = () =>
      blockFlow.$relatedQuery('steps').orderBy('position', 'asc')

    beforeEach(async () => {
      blockFlow = await owner.$relatedQuery('flows').insertAndFetch({
        name: 'Upgrade Flow',
      })
      blockFlowInput = { flow: { updatedAt: blockFlow.updatedAt } }
    })

    it('pins other legacy if-then blocks when deleting an unrelated step, and composes with repair', async () => {
      // Both if-thens are legacy. `unrelated` (the step being deleted) is
      // the last step in the flow, so it's part of ifThenB's V1 extent until
      // the delete removes it.
      // IMPORTANT: the existing repair logic (unmodified by this pass) then
      // re-points ifThenB back to childB once `unrelated` is gone.
      await addTrigger('catchRawWebhook', 'custom-api')
      const ifThenA = await addIfThen(2)
      const childA = await addPlain(3)
      const ifThenB = await addIfThen(4)
      const childB = await addPlain(5)
      const unrelated = await addPlain(6)
      mocks.getLdFlagValue.mockResolvedValue(true)

      await deleteStep(
        null,
        { input: { ids: [unrelated.id], ...blockFlowInput } },
        context,
      )

      const steps = await currentSteps()
      expect(steps.find((s) => s.id === ifThenA.id)?.config.endStepId).toBe(
        childA.id,
      )
      expect(steps.find((s) => s.id === ifThenB.id)?.config.endStepId).toBe(
        childB.id,
      )
    })

    it('does not pin any V1 if-then block when the flag is off', async () => {
      await addTrigger('catchRawWebhook', 'custom-api')
      const ifThenA = await addIfThen(2)
      await addPlain(3)
      const ifThenB = await addIfThen(4)
      await addPlain(5)
      const unrelated = await addPlain(6)
      mocks.getLdFlagValue.mockResolvedValue(false)

      await deleteStep(
        null,
        { input: { ids: [unrelated.id], ...blockFlowInput } },
        context,
      )

      const steps = await currentSteps()
      expect(
        steps.find((s) => s.id === ifThenA.id)?.config.endStepId,
      ).toBeUndefined()
      expect(
        steps.find((s) => s.id === ifThenB.id)?.config.endStepId,
      ).toBeUndefined()
    })
  })
})
