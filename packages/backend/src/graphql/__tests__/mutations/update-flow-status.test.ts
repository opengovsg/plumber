import { beforeEach, describe, expect, it, vi } from 'vitest'

import cronTimes from '@/apps/scheduler/common/cron-times'
import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
} from '@/apps/toolbox/common/constants'
import updateFlowStatus from '@/graphql/mutations/update-flow-status'
import {
  REMOVE_AFTER_7_DAYS_OR_50_JOBS,
  REMOVE_AFTER_30_DAYS,
} from '@/helpers/default-job-configuration'
import flowQueue from '@/queues/flow'

// In these tests we simulate the chaining of queries on currentUser.$relatedQuery('flows')
// and the additional methods on the flow: $query, getTriggerStep etc.
describe('updateFlowStatus', () => {
  let fakeFlow: any
  let fakeQuery: any
  let context: any
  let fakeTriggerStep: any
  let patchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.resetAllMocks()

    // Create a fake flow object with default values.
    fakeFlow = {
      id: 'flow-1',
      active: false,
      steps: [{ position: 1 }, { position: 2 }], // contiguous by default
      // we will override $query to simulate patch operations
      $query: vi.fn(),
      getTriggerStep: vi.fn(),
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

    context = {
      currentUser: {
        $relatedQuery: vi.fn().mockReturnValue(fakeQuery),
      },
    }

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
  })

  it('returns the flow without changes if the active status did not change', async () => {
    // Set the flow status to true and provide the same value in input.
    fakeFlow.active = true

    const params = { input: { id: fakeFlow.id, active: true } }
    const result = await updateFlowStatus({}, params, context)

    expect(result).toEqual(fakeFlow)
    // The patch/update should not be triggered
    expect(fakeFlow.$query).not.toHaveBeenCalled()
    expect(fakeFlow.getTriggerStep).not.toHaveBeenCalled()
  })

  it('throws an error when activating a flow with non-contiguous step positions', async () => {
    // Prepare a flow with steps that are not contiguous.
    fakeFlow.active = false
    fakeFlow.steps = [{ position: 1 }, { position: 3 }]

    const params = { input: { id: fakeFlow.id, active: true } }

    await expect(updateFlowStatus({}, params, context)).rejects.toThrow(
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

    const params = { input: { id: fakeFlow.id, active: true } }

    await expect(updateFlowStatus({}, params, context)).rejects.toThrow(
      'Flow must have exactly one for-each step. Please contact support@plumber.gov.sg for help.',
    )
  })

  it('activates the flow and enqueues a job for non-webhook triggers', async () => {
    // Starting state where the flow is inactive and input sets it to active.
    fakeFlow.active = false
    fakeFlow.steps = [{ position: 1 }, { position: 2 }]

    const params = { input: { id: fakeFlow.id, active: true } }
    const result = await updateFlowStatus({}, params, context)

    // Validate that we patched the flow with active true and publishedAt set to an ISO string.
    expect(patchSpy).toHaveBeenCalledWith({
      active: true,
      publishedAt: expect.any(String),
      config: {
        showSurvey: true,
      },
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

    const params = { input: { id: fakeFlow.id, active: false } }
    const result = await updateFlowStatus({}, params, context)

    expect(patchSpy).toHaveBeenCalledWith({
      active: false,
      publishedAt: null,
      config: {
        showSurvey: undefined,
      },
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

    const params = { input: { id: fakeFlow.id, active: true } }
    const result = await updateFlowStatus({}, params, context)

    // The patch should still occur.
    expect(patchSpy).toHaveBeenCalledWith({
      active: true,
      publishedAt: expect.any(String),
      config: {
        showSurvey: true,
      },
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

    const params = { input: { id: fakeFlow.id, active: false } }
    const result = await updateFlowStatus({}, params, context)

    expect(patchSpy).toHaveBeenCalledWith({
      active: false,
      publishedAt: null,
      config: {
        showSurvey: undefined,
      },
    })

    // For webhook triggers no removal of a repeatable job should be attempted.
    expect(flowQueue.getRepeatableJobs).not.toHaveBeenCalled()
    expect(flowQueue.removeRepeatableByKey).not.toHaveBeenCalled()
    expect(result).toEqual(fakeFlow)
  })
})
