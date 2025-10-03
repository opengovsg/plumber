import { randomUUID } from 'crypto'
import { NotFoundError } from 'objection'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
import Flow from '@/models/flow'
import User from '@/models/user'
import flowQueue from '@/queues/flow'

import { generateMockContext } from './tiles/table.mock'
import { generateMockCollaborator, generateMockUser } from './flow.mock'

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
    ).rejects.toThrow(
      'Step positions are out of order. Please contact support@plumber.gov.sg for help.',
    )
  })

  it('throws an error when activating a flow with more than one for-each step', async () => {
    fakeFlow.active = false
    fakeFlow.steps = [
      { position: 1 },
      { position: 2, appKey: TOOLBOX_APP_KEY, key: TOOLBOX_ACTIONS.FOR_EACH },
      { position: 3, appKey: TOOLBOX_APP_KEY, key: TOOLBOX_ACTIONS.FOR_EACH },
    ]

    await expect(
      updateFlowStatus({}, { input: defaultInput }, context),
    ).rejects.toThrow(
      'Flow must have exactly one for-each step. Please contact support@plumber.gov.sg for help.',
    )
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
      config: {
        showSurvey: true,
      },
      updatedBy: owner.id,
    })

    // jobName is constructed as "flow-<flow.id>"
    expect(flowQueue.add).toHaveBeenCalledWith(
      `flow-${fakeFlow.id}`,
      { flowId: fakeFlow.id },
      {
        repeat: { pattern: '0 * * * *' },
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

    // Simulate that a repeatable job exists for this flow.
    flowQueue.getRepeatableJobs = vi
      .fn()
      .mockResolvedValue([{ id: fakeFlow.id, key: 'repeat-key' }])

    const result = await updateFlowStatus(
      {},
      { input: { ...defaultInput, active: false } },
      context,
    )

    expect(patchSpy).toHaveBeenCalledWith({
      active: false,
      publishedAt: null,
      config: {
        showSurvey: undefined,
      },
      updatedBy: owner.id,
    })

    expect(flowQueue.removeRepeatableByKey).toHaveBeenCalledWith('repeat-key')
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
      config: {
        showSurvey: true,
      },
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
      config: {
        showSurvey: undefined,
      },
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
        config: {
          showSurvey: true,
        },
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
        config: {
          showSurvey: true,
        },
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
      )
      expect(patchSpy).toHaveBeenCalledWith({
        active: true,
        publishedAt: expect.any(String),
        config: {
          showSurvey: true,
        },
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
})
