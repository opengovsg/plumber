import { beforeEach, describe, expect, it, vi } from 'vitest'

import triggerFlowManually from '@/graphql/mutations/trigger-flow-manually'
import type Context from '@/types/express/context'

const mocks = vi.hoisted(() => ({
  processTrigger: vi.fn(),
  enqueueActionJob: vi.fn(),
}))

vi.mock('@/services/trigger', () => ({
  processTrigger: mocks.processTrigger,
}))

vi.mock('@/queues/action', () => ({
  enqueueActionJob: mocks.enqueueActionJob,
}))

class FakeNotFoundError extends Error {}

function makeContext({
  flow,
  findOneImpl,
}: {
  flow?: Record<string, unknown>
  findOneImpl?: () => { throwIfNotFound: () => Promise<unknown> }
} = {}) {
  const findOne =
    findOneImpl ??
    (() => ({
      throwIfNotFound: () => Promise.resolve(flow),
    }))

  const withAccessibleFlows = vi.fn().mockReturnValue({ findOne })

  return {
    currentUser: {
      withAccessibleFlows,
    },
  } as unknown as Context
}

describe('triggerFlowManually mutation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('propagates the error when the user cannot access the flow', async () => {
    const context = makeContext({
      findOneImpl: () => ({
        throwIfNotFound: () =>
          Promise.reject(new FakeNotFoundError('not found')),
      }),
    })

    await expect(
      triggerFlowManually(null, { input: { flowId: 'flow-1' } }, context),
    ).rejects.toThrow('not found')

    expect(mocks.processTrigger).not.toHaveBeenCalled()
    expect(mocks.enqueueActionJob).not.toHaveBeenCalled()
  })

  it('rejects when the flow is not published', async () => {
    const flow = {
      id: 'flow-1',
      active: false,
      getTriggerStep: vi.fn(),
    }
    const context = makeContext({ flow })

    await expect(
      triggerFlowManually(null, { input: { flowId: 'flow-1' } }, context),
    ).rejects.toThrow(/published/i)

    expect(flow.getTriggerStep).not.toHaveBeenCalled()
    expect(mocks.processTrigger).not.toHaveBeenCalled()
  })

  it('rejects when the trigger step is not the manual trigger app', async () => {
    const flow = {
      id: 'flow-1',
      active: true,
      getTriggerStep: vi.fn().mockResolvedValue({
        id: 'step-1',
        appKey: 'scheduler',
      }),
    }
    const context = makeContext({ flow })

    await expect(
      triggerFlowManually(null, { input: { flowId: 'flow-1' } }, context),
    ).rejects.toThrow(/manual trigger/i)

    expect(mocks.processTrigger).not.toHaveBeenCalled()
    expect(mocks.enqueueActionJob).not.toHaveBeenCalled()
  })

  it('dispatches the next step job on the happy path', async () => {
    const nextStep = {
      id: 'step-2',
      appKey: 'postman',
    }
    const triggerStep = {
      id: 'step-1',
      appKey: 'manual',
      getNextStep: vi.fn().mockResolvedValue(nextStep),
    }
    const flow = {
      id: 'flow-1',
      active: true,
      getTriggerStep: vi.fn().mockResolvedValue(triggerStep),
    }
    const context = makeContext({ flow })

    mocks.processTrigger.mockResolvedValue({
      executionId: 'exec-1',
      shouldExecute: true,
    })

    const result = await triggerFlowManually(
      null,
      { input: { flowId: 'flow-1' } },
      context,
    )

    expect(result).toBe('exec-1')
    expect(mocks.processTrigger).toHaveBeenCalledWith(
      expect.objectContaining({
        flowId: 'flow-1',
        stepId: 'step-1',
        testRun: false,
      }),
    )
    expect(mocks.enqueueActionJob).toHaveBeenCalledWith(
      expect.objectContaining({
        appKey: 'postman',
        jobName: 'exec-1-step-2',
        jobData: {
          flowId: 'flow-1',
          executionId: 'exec-1',
          stepId: 'step-2',
        },
      }),
    )
  })

  it('does not enqueue a job when the trigger indicates execution should not proceed', async () => {
    const triggerStep = {
      id: 'step-1',
      appKey: 'manual',
      getNextStep: vi.fn(),
    }
    const flow = {
      id: 'flow-1',
      active: true,
      getTriggerStep: vi.fn().mockResolvedValue(triggerStep),
    }
    const context = makeContext({ flow })

    mocks.processTrigger.mockResolvedValue({
      executionId: 'exec-2',
      shouldExecute: false,
    })

    const result = await triggerFlowManually(
      null,
      { input: { flowId: 'flow-1' } },
      context,
    )

    expect(result).toBe('exec-2')
    expect(triggerStep.getNextStep).not.toHaveBeenCalled()
    expect(mocks.enqueueActionJob).not.toHaveBeenCalled()
  })
})
