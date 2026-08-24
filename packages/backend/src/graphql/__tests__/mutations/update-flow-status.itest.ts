import { randomUUID } from 'crypto'

import { NotFoundError } from 'objection'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import cronTimes from '@/apps/scheduler/common/cron-times'
import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
} from '@/apps/toolbox/common/constants'
import { BadUserInputError } from '@/errors/graphql-errors'
import updateFlowStatus from '@/graphql/mutations/update-flow-status'
import {
  REMOVE_AFTER_7_DAYS_OR_50_JOBS,
  REMOVE_AFTER_30_DAYS,
} from '@/helpers/default-job-configuration'
import logger from '@/helpers/logger'
import Flow from '@/models/flow'
import Step from '@/models/step'
import User from '@/models/user'
import flowQueue from '@/queues/flow'

import { generateMockCollaborator, generateMockUser } from './flow.mock'
import { generateMockContext } from './tiles/table.mock'

// Captured at module load before the outer `beforeEach` reassigns these to
// vi.fn(); used by the real-BullMQ describe block to bypass the mocks.
const realFlowQueue = {
  add: flowQueue.add.bind(flowQueue),
  getRepeatableJobs: flowQueue.getRepeatableJobs.bind(flowQueue),
  removeRepeatableByKey: flowQueue.removeRepeatableByKey.bind(flowQueue),
  obliterate: flowQueue.obliterate.bind(flowQueue),
}

// In these tests we simulate the chaining of queries on currentUser.$relatedQuery('flows')
// and the additional methods on the flow: $query, getTriggerStep etc.
describe('updateFlowStatus', () => {
  let fakeFlow: any
  let fakeQuery: any
  let context: any
  let owner: User
  let editor: User
  let viewer: User
  let nonCollaborator: User
  let fakeTriggerStep: any
  let patchSpy: ReturnType<typeof vi.fn>
  let defaultInput: any

  beforeEach(async () => {
    vi.resetAllMocks()

    context = await generateMockContext()
    owner = context.currentUser

    // Create a real flow in the database first
    const fakeFlowId = randomUUID()
    await Flow.query().insert({
      id: fakeFlowId,
      name: 'Test Flow',
      userId: owner.id,
      active: false,
    })

    // Seed steps so $beforeUpdate validations pass for tests that exercise the
    // real DB row (transaction rollback + bullmq integration blocks).
    await Step.query().insert([
      {
        flowId: fakeFlowId,
        type: 'trigger',
        position: 1,
        status: 'completed',
        appKey: 'scheduler',
        key: 'everyHour',
        parameters: {},
      },
      {
        flowId: fakeFlowId,
        type: 'action',
        position: 2,
        status: 'completed',
        appKey: 'custom-api',
        key: 'httpRequest',
        parameters: {},
      },
    ])

    // Create a fake flow object with default values.
    fakeFlow = {
      id: fakeFlowId,
      active: false,
      steps: [{ position: 1 }, { position: 2 }], // contiguous by default
      updatedAt: new Date().toISOString(),
      // we will override $query to simulate patch operations
      $query: vi.fn(),
      getTriggerStep: vi.fn(),
      assertNotUpdatedSince: vi.fn(),
    }
    patchSpy = vi.fn().mockResolvedValue(undefined)
    fakeFlow.$query.mockReturnValue({ patch: patchSpy })

    // Fake the chained query methods on context.currentUser.$relatedQuery('flows')
    fakeQuery = {
      findOne: vi.fn().mockReturnThis(),
      withGraphJoined: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      throwIfNotFound: vi.fn().mockResolvedValue(fakeFlow),
    }

    context.currentUser.withAccessibleFlows = vi.fn().mockReturnValue(fakeQuery)

    editor = await generateMockUser('editor')
    viewer = await generateMockUser('viewer')
    nonCollaborator = await generateMockUser('nonCollaborator')

    await generateMockCollaborator(fakeFlow.id, editor.id, owner.id, 'editor')
    await generateMockCollaborator(fakeFlow.id, viewer.id, owner.id, 'viewer')

    // Set up a default fake trigger step returning a trigger command.
    fakeTriggerStep = {
      parameters: {},
      getTriggerCommand: vi.fn().mockResolvedValue({
        getInterval: vi.fn().mockReturnValue(cronTimes.everyHour),
      }),
    }
    fakeFlow.getTriggerStep.mockResolvedValue(fakeTriggerStep)

    // Mock flowQueue methods.
    flowQueue.add = vi.fn().mockResolvedValue(undefined)
    flowQueue.getRepeatableJobs = vi
      .fn()
      .mockResolvedValue([{ id: fakeFlow.id, key: 'repeat-key' }])
    flowQueue.removeRepeatableByKey = vi.fn().mockResolvedValue(undefined)

    defaultInput = {
      id: fakeFlow.id,
      active: true,
      updatedAt: fakeFlow.updatedAt,
    }
  })

  it('returns the flow without changes if the active status did not change', async () => {
    // Set the flow status to true and provide the same value in input.
    fakeFlow.active = true

    const result = await updateFlowStatus({}, { input: defaultInput }, context)

    expect(result).toEqual(fakeFlow)
    // The patch/update should not be triggered
    expect(fakeFlow.$query).not.toHaveBeenCalled()
    expect(fakeFlow.getTriggerStep).not.toHaveBeenCalled()
  })

  it('throws an error when activating a flow with non-contiguous step positions', async () => {
    // Prepare a flow with steps that are not contiguous.
    fakeFlow.active = false
    fakeFlow.steps = [{ position: 1 }, { position: 3 }]

    await expect(
      updateFlowStatus({}, { input: defaultInput }, context),
    ).rejects.toThrow('Step positions are out of order.')
  })

  it('throws an error when publishing a flow with more than one for-each step', async () => {
    fakeFlow.active = false
    fakeFlow.steps = [
      { position: 1 },
      {
        position: 2,
        appKey: TOOLBOX_APP_KEY,
        key: TOOLBOX_ACTIONS.FOR_EACH,
        config: {},
      },
      {
        position: 3,
        appKey: TOOLBOX_APP_KEY,
        key: TOOLBOX_ACTIONS.FOR_EACH,
        config: {},
      },
    ]

    await expect(
      updateFlowStatus({}, { input: defaultInput }, context),
    ).rejects.toThrow('Flow must have exactly one for-each step.')
  })

  it('throws an error when publishing a flow with 2 for-each step in the same branch', async () => {
    fakeFlow.active = false
    fakeFlow.steps = [
      { position: 1 },
      {
        position: 2,
        appKey: TOOLBOX_APP_KEY,
        key: TOOLBOX_ACTIONS.FOR_EACH,
        config: { approval: { branch: 'reject', stepId: 'mrf1' } },
      },
      {
        position: 3,
        appKey: TOOLBOX_APP_KEY,
        key: TOOLBOX_ACTIONS.FOR_EACH,
        config: { approval: { branch: 'reject', stepId: 'mrf1' } },
      },
    ]

    await expect(
      updateFlowStatus({}, { input: defaultInput }, context),
    ).rejects.toThrow('Flow must have exactly one for-each step.')
  })

  it('should not throw an error when publishing a flow with 2 for-each step in different branches', async () => {
    fakeFlow.active = false
    fakeFlow.steps = [
      { position: 1 },
      {
        position: 2,
        appKey: TOOLBOX_APP_KEY,
        key: TOOLBOX_ACTIONS.FOR_EACH,
        config: {},
      },
      {
        position: 3,
        appKey: TOOLBOX_APP_KEY,
        key: TOOLBOX_ACTIONS.FOR_EACH,
        config: { approval: { branch: 'reject', stepId: 'mrf1' } },
      },
    ]

    await expect(
      updateFlowStatus({}, { input: defaultInput }, context),
    ).resolves.not.toThrow()
  })

  it('activates the flow and enqueues a job for non-webhook triggers', async () => {
    // Starting state where the flow is inactive and input sets it to active.
    fakeFlow.active = false
    fakeFlow.steps = [{ position: 1 }, { position: 2 }]

    const result = await updateFlowStatus({}, { input: defaultInput }, context)

    // Validate that we patched the flow with active true and publishedAt set to an ISO string.
    expect(patchSpy).toHaveBeenCalledWith({
      active: true,
      publishedAt: expect.any(String),
      config: {},
      updatedBy: owner.id,
    })

    // jobName is constructed as "flow-<flow.id>" and is also used as the
    // custom repeatable key so we can identify the job by prefix later.
    expect(flowQueue.add).toHaveBeenCalledWith(
      `flow-${fakeFlow.id}`,
      { flowId: fakeFlow.id },
      {
        repeat: { pattern: '0 * * * *', key: `flow-${fakeFlow.id}` },
        jobId: fakeFlow.id,
        removeOnComplete: REMOVE_AFTER_7_DAYS_OR_50_JOBS,
        removeOnFail: REMOVE_AFTER_30_DAYS,
      },
    )

    expect(result).toEqual(fakeFlow)
  })

  it('deactivates the flow and removes the repeatable job for non-webhook triggers', async () => {
    // For deactivation, ensure the current flow is active and we are setting it to inactive.
    fakeFlow.active = true

    // Simulate that a repeatable job exists for this flow. The new code finds
    // the job via `key.startsWith("flow-<id>")`, so the mocked key must match
    // that prefix.
    const repeatableKey = `flow-${fakeFlow.id}`
    flowQueue.getRepeatableJobs = vi
      .fn()
      .mockResolvedValue([{ id: fakeFlow.id, key: repeatableKey }])

    const result = await updateFlowStatus(
      {},
      { input: { ...defaultInput, active: false } },
      context,
    )

    expect(patchSpy).toHaveBeenCalledWith({
      active: false,
      publishedAt: null,
      config: {},
      updatedBy: owner.id,
    })

    expect(flowQueue.removeRepeatableByKey).toHaveBeenCalledWith(repeatableKey)
    expect(result).toEqual(fakeFlow)
  })

  it('does not perform any queue actions when the trigger type is webhook on activation', async () => {
    // Flow activation but the trigger is of type webhook.
    fakeFlow.active = false
    fakeFlow.steps = [{ position: 1 }, { position: 2 }]

    fakeTriggerStep.getTriggerCommand.mockResolvedValue({
      type: 'webhook',
    })

    const result = await updateFlowStatus({}, { input: defaultInput }, context)

    // The patch should still occur.
    expect(patchSpy).toHaveBeenCalledWith({
      active: true,
      publishedAt: expect.any(String),
      config: {},
      updatedBy: owner.id,
    })

    // But no job should be added when trigger type is webhook.
    expect(flowQueue.add).not.toHaveBeenCalled()
    expect(result).toEqual(fakeFlow)
  })

  it('does not perform any queue actions when the trigger type is webhook on deactivation', async () => {
    // Flow deactivation but the trigger is of type webhook.
    fakeFlow.active = true

    fakeTriggerStep.getTriggerCommand.mockResolvedValue({
      type: 'webhook',
    })

    const result = await updateFlowStatus(
      {},
      { input: { ...defaultInput, active: false } },
      context,
    )

    expect(patchSpy).toHaveBeenCalledWith({
      active: false,
      publishedAt: null,
      config: {},
      updatedBy: owner.id,
    })

    // For webhook triggers no removal of a repeatable job should be attempted.
    expect(flowQueue.getRepeatableJobs).not.toHaveBeenCalled()
    expect(flowQueue.removeRepeatableByKey).not.toHaveBeenCalled()
    expect(result).toEqual(fakeFlow)
  })

  describe('access control', () => {
    it('should allow owner to update flow status', async () => {
      const result = await updateFlowStatus(
        {},
        { input: defaultInput },
        context,
      )
      expect(result).toEqual(fakeFlow)
      expect(patchSpy).toHaveBeenCalledWith({
        active: true,
        publishedAt: expect.any(String),
        config: {},
        updatedBy: owner.id,
      })
    })

    it('should allow editor to update flow status', async () => {
      context.currentUser = editor
      context.currentUser.withAccessibleFlows = vi
        .fn()
        .mockReturnValue(fakeQuery)
      const result = await updateFlowStatus(
        {},
        { input: defaultInput },
        context,
      )
      expect(result).toEqual(fakeFlow)
      expect(patchSpy).toHaveBeenCalledWith({
        active: true,
        publishedAt: expect.any(String),
        config: {},
        updatedBy: editor.id,
      })
    })

    it('should not allow viewer to update flow status', async () => {
      context.currentUser = viewer
      await expect(
        updateFlowStatus({}, { input: defaultInput }, context),
      ).rejects.toThrow(NotFoundError)
    })

    it('should not allow non-collaborator to update flow status', async () => {
      context.currentUser = nonCollaborator
      await expect(
        updateFlowStatus({}, { input: defaultInput }, context),
      ).rejects.toThrow(NotFoundError)
    })
  })

  describe('collaboration', () => {
    it('should allow update to status if flow is up to date', async () => {
      context.currentUser = editor
      context.currentUser.withAccessibleFlows = vi
        .fn()
        .mockReturnValue(fakeQuery)

      // Mock assertNotUpdatedSince to not throw (timestamps match)
      fakeFlow.assertNotUpdatedSince.mockImplementation(() => {
        // No error thrown - timestamps match
      })

      const result = await updateFlowStatus(
        {},
        { input: defaultInput },
        context,
      )

      expect(result).toEqual(fakeFlow)
      expect(fakeFlow.assertNotUpdatedSince).toHaveBeenCalledWith(
        defaultInput.updatedAt,
        editor.id,
      )
      expect(patchSpy).toHaveBeenCalledWith({
        active: true,
        publishedAt: expect.any(String),
        config: {},
        updatedBy: editor.id,
      })
    })

    it('should not allow update to status if flow is not up to date', async () => {
      context.currentUser = editor
      context.currentUser.withAccessibleFlows = vi
        .fn()
        .mockReturnValue(fakeQuery)

      // Mock assertNotUpdatedSince to throw an error when timestamps don't match
      fakeFlow.assertNotUpdatedSince.mockImplementation(() => {
        throw new BadUserInputError(
          'This Pipe has been edited by another user. Please refresh the page to see the latest changes and try again.',
        )
      })

      await expect(
        updateFlowStatus({}, { input: defaultInput }, context),
      ).rejects.toThrow(
        'This Pipe has been edited by another user. Please refresh the page to see the latest changes and try again.',
      )
    })
  })

  describe('transaction rollback', () => {
    it('rolls back the DB write when flowQueue.add fails during publish', async () => {
      // Replace the mocked flow with the real DB row so $query.patch actually
      // writes inside the transaction and rollback is observable
      const realFlow: any = await Flow.query().findById(fakeFlow.id)
      realFlow.steps = [{ position: 1 }, { position: 2 }]
      realFlow.getTriggerStep = fakeFlow.getTriggerStep
      realFlow.assertNotUpdatedSince = vi.fn()
      fakeQuery.throwIfNotFound.mockResolvedValue(realFlow)

      flowQueue.add = vi.fn().mockRejectedValue(new Error('queue down'))

      await expect(
        updateFlowStatus(
          {},
          { input: { ...defaultInput, updatedAt: realFlow.updatedAt } },
          context,
        ),
      ).rejects.toThrow('queue down')

      const refetched = await Flow.query().findById(fakeFlow.id)
      expect(refetched.active).toBe(false)
      expect(refetched.publishedAt).toBeNull()
    })

    it('rolls back the DB write when removeRepeatableByKey fails during unpublish', async () => {
      // Seed the row as active so we exercise the deactivate path. Use an
      // instance patch so objection populates `opt.old` for $beforeUpdate.
      const seedFlow = await Flow.query().findById(fakeFlow.id)
      await seedFlow.$query().patch({
        active: true,
        publishedAt: new Date().toISOString(),
      })
      const realFlow: any = await Flow.query().findById(fakeFlow.id)
      realFlow.steps = [{ position: 1 }, { position: 2 }]
      realFlow.getTriggerStep = fakeFlow.getTriggerStep
      realFlow.assertNotUpdatedSince = vi.fn()
      fakeQuery.throwIfNotFound.mockResolvedValue(realFlow)

      flowQueue.getRepeatableJobs = vi
        .fn()
        .mockResolvedValue([{ id: fakeFlow.id, key: `flow-${fakeFlow.id}` }])
      flowQueue.removeRepeatableByKey = vi
        .fn()
        .mockRejectedValue(new Error('queue down'))

      await expect(
        updateFlowStatus(
          {},
          {
            input: {
              ...defaultInput,
              active: false,
              updatedAt: realFlow.updatedAt,
            },
          },
          context,
        ),
      ).rejects.toThrow('queue down')

      const refetched = await Flow.query().findById(fakeFlow.id)
      expect(refetched.active).toBe(true)
      expect(refetched.publishedAt).not.toBeNull()
    })

    it('logs a warning and does not call removeRepeatableByKey when no repeatable job is found on unpublish', async () => {
      fakeFlow.active = true
      // No repeatable job whose key starts with `flow-<id>`
      flowQueue.getRepeatableJobs = vi
        .fn()
        .mockResolvedValue([{ id: 'someone-else', key: 'flow-someone-else' }])
      flowQueue.removeRepeatableByKey = vi.fn().mockResolvedValue(undefined)

      const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => logger)

      const result = await updateFlowStatus(
        {},
        { input: { ...defaultInput, active: false } },
        context,
      )

      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: `Bug: No repeatable job found for flow ${fakeFlow.id} when trying to remove repeatable job upon unpublishing.`,
          flowId: fakeFlow.id,
          jobName: `flow-${fakeFlow.id}`,
        }),
      )
      expect(flowQueue.removeRepeatableByKey).not.toHaveBeenCalled()
      expect(result).toEqual(fakeFlow)

      warnSpy.mockRestore()
    })
  })

  describe('bullmq integration (real Redis)', () => {
    // The outer beforeEach replaced flowQueue methods with vi.fn(); restore
    // the originals here so we exercise real BullMQ against the test container.
    beforeEach(async () => {
      flowQueue.add = realFlowQueue.add
      flowQueue.getRepeatableJobs = realFlowQueue.getRepeatableJobs
      flowQueue.removeRepeatableByKey = realFlowQueue.removeRepeatableByKey

      // Use the real DB row + real $query so the patch persists inside the
      // transaction (the test asserts via getRepeatableJobs, not patchSpy).
      const realFlow: any = await Flow.query().findById(fakeFlow.id)
      realFlow.steps = [{ position: 1 }, { position: 2 }]
      realFlow.getTriggerStep = fakeFlow.getTriggerStep
      realFlow.assertNotUpdatedSince = vi.fn()
      fakeQuery.throwIfNotFound.mockResolvedValue(realFlow)
    })

    afterEach(async () => {
      // Redis is not reset between tests by the global setup, so clean up
      // anything we wrote.
      await realFlowQueue.obliterate({ force: true })
    })

    it('adds a repeatable job whose key matches the custom flow-<id> key on publish', async () => {
      const realFlow = await Flow.query().findById(fakeFlow.id)

      await updateFlowStatus(
        {},
        { input: { ...defaultInput, updatedAt: realFlow.updatedAt } },
        context,
      )

      const jobs = await flowQueue.getRepeatableJobs()
      const job = jobs.find((j) => j.key.startsWith(`flow-${fakeFlow.id}`))
      expect(job).toBeDefined()
      // for the old bullmq@5.7.8 it accepts the repeat key but does not use it
      // it still derives by concatenating the metadata
      // we check the starting pattern to ensure compatibility with the newer bullmq@5 and the older bullmq@5 versions
      expect(job.key).toMatch(new RegExp(`^flow-${fakeFlow.id}`))
    })

    it('removes the repeatable job on unpublish using the custom key', async () => {
      // Publish first
      let realFlow = await Flow.query().findById(fakeFlow.id)
      await updateFlowStatus(
        {},
        { input: { ...defaultInput, updatedAt: realFlow.updatedAt } },
        context,
      )

      // Sanity-check the job is in Redis
      let jobs = await flowQueue.getRepeatableJobs()
      expect(
        jobs.find((j) => j.key.startsWith(`flow-${fakeFlow.id}`)),
      ).toBeDefined()

      // Re-prime the mocked query with the now-active row for the unpublish
      realFlow = await Flow.query().findById(fakeFlow.id)
      ;(realFlow as any).steps = [{ position: 1 }, { position: 2 }]
      ;(realFlow as any).getTriggerStep = fakeFlow.getTriggerStep
      ;(realFlow as any).assertNotUpdatedSince = vi.fn()
      fakeQuery.throwIfNotFound.mockResolvedValue(realFlow)

      await updateFlowStatus(
        {},
        {
          input: {
            ...defaultInput,
            active: false,
            updatedAt: realFlow.updatedAt,
          },
        },
        context,
      )

      jobs = await flowQueue.getRepeatableJobs()
      expect(
        jobs.find((j) => j.key.startsWith(`flow-${fakeFlow.id}`)),
      ).toBeUndefined()
    })
  })
})
