import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createMrfActionStep,
  generateMockContext,
  generateMockFlow,
  generateMockStep,
} from '@/apps/formsg/__tests__/mrf.mock'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import type Context from '@/types/express/context'
import { claimSubTriggerAndEnqueueNext } from '@/workers/helpers/claim-sub-trigger-and-enqueue-next'

const mocks = vi.hoisted(() => ({
  enqueueActionJob: vi.fn(),
  loggerWarn: vi.fn(),
  loggerDebug: vi.fn(),
}))

vi.mock('@/queues/action', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/queues/action')>()
  return {
    ...actual,
    enqueueActionJob: mocks.enqueueActionJob,
  }
})

vi.mock('@/helpers/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: mocks.loggerWarn,
    debug: mocks.loggerDebug,
  },
}))

const FLOW_ID = '00000000-0000-0000-0000-000000000001'

describe('claimSubTriggerAndEnqueueNext', () => {
  let context: Context

  beforeEach(async () => {
    vi.clearAllMocks()
    mocks.enqueueActionJob.mockResolvedValue({})
    context = await generateMockContext()
    await generateMockFlow(context, FLOW_ID)
  })

  async function seedPendingHandoff() {
    const mrfStep = await createMrfActionStep({
      context,
      flowId: FLOW_ID,
      position: 2,
      formWorkflowStepId: 'wf-step-002',
    })
    const nextStep = await generateMockStep(
      context,
      'dateTime',
      'formatter',
      'action',
      FLOW_ID,
      3,
    )
    const execution = await Execution.query().insertAndFetch({
      flowId: FLOW_ID,
      testRun: false,
      internalId: 'internal-123',
    })
    const executionStep = await ExecutionStep.query().insertAndFetch({
      executionId: execution.id,
      stepId: mrfStep.id,
      dataIn: mrfStep.parameters,
      dataOut: { submissionTime: '2024-03-25T08:15:30.250+08:00' },
      appKey: mrfStep.appKey,
      key: mrfStep.key,
    })
    return { mrfStep, nextStep, execution, executionStep }
  }

  it('commits success before enqueueing the next job', async () => {
    const { mrfStep, nextStep, execution, executionStep } =
      await seedPendingHandoff()

    mocks.enqueueActionJob.mockImplementation(async () => {
      const row = await ExecutionStep.query().findById(executionStep.id)
      expect(row?.status).toBe('success')
      return {}
    })

    await claimSubTriggerAndEnqueueNext({
      executionId: execution.id,
      stepId: mrfStep.id,
      nextStep,
      jobName: `${execution.id}-${mrfStep.id}`,
      jobPayload: {
        flowId: FLOW_ID,
        executionId: execution.id,
        stepId: nextStep.id,
      },
    })

    expect(mocks.enqueueActionJob).toHaveBeenCalledOnce()
    expect(mocks.enqueueActionJob).toHaveBeenCalledWith(
      expect.objectContaining({
        appKey: nextStep.appKey,
        jobName: `${execution.id}-${mrfStep.id}`,
        jobData: {
          flowId: FLOW_ID,
          executionId: execution.id,
          stepId: nextStep.id,
        },
        jobOptions: expect.objectContaining({
          jobId: `${execution.id}-${nextStep.id}`,
        }),
      }),
    )
    const row = await ExecutionStep.query().findById(executionStep.id)
    expect(row?.status).toBe('success')
  })

  it('still enqueues when the execution step is already successful', async () => {
    const { mrfStep, nextStep, execution, executionStep } =
      await seedPendingHandoff()
    await executionStep.$query().patch({ status: 'success' })

    await claimSubTriggerAndEnqueueNext({
      executionId: execution.id,
      stepId: mrfStep.id,
      nextStep,
      jobName: `${execution.id}-${mrfStep.id}`,
      jobPayload: {
        flowId: FLOW_ID,
        executionId: execution.id,
        stepId: nextStep.id,
      },
    })

    expect(mocks.enqueueActionJob).toHaveBeenCalledOnce()
    const row = await ExecutionStep.query().findById(executionStep.id)
    expect(row?.status).toBe('success')
  })

  it('does not enqueue when the execution step is missing', async () => {
    const nextStep = await generateMockStep(
      context,
      'dateTime',
      'formatter',
      'action',
      FLOW_ID,
      2,
    )
    const execution = await Execution.query().insertAndFetch({
      flowId: FLOW_ID,
      testRun: false,
      internalId: 'internal-missing',
    })

    await claimSubTriggerAndEnqueueNext({
      executionId: execution.id,
      stepId: nextStep.id,
      nextStep,
      jobName: `${execution.id}-${nextStep.id}`,
      jobPayload: {
        flowId: FLOW_ID,
        executionId: execution.id,
        stepId: nextStep.id,
      },
    })

    expect(mocks.enqueueActionJob).not.toHaveBeenCalled()
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      'bug: Execution step not found',
      expect.objectContaining({
        event: 'sub-trigger-execution-step-not-found',
      }),
    )
  })

  it('clears success so a retry can claim again if enqueue throws', async () => {
    const { mrfStep, nextStep, execution, executionStep } =
      await seedPendingHandoff()
    mocks.enqueueActionJob.mockRejectedValueOnce(new Error('redis down'))

    await expect(
      claimSubTriggerAndEnqueueNext({
        executionId: execution.id,
        stepId: mrfStep.id,
        nextStep,
        jobName: `${execution.id}-${mrfStep.id}`,
        jobPayload: {
          flowId: FLOW_ID,
          executionId: execution.id,
          stepId: nextStep.id,
        },
      }),
    ).rejects.toThrow('redis down')

    const row = await ExecutionStep.query().findById(executionStep.id)
    expect(row?.status).toBeNull()

    mocks.enqueueActionJob.mockResolvedValueOnce({})
    await claimSubTriggerAndEnqueueNext({
      executionId: execution.id,
      stepId: mrfStep.id,
      nextStep,
      jobName: `${execution.id}-${mrfStep.id}`,
      jobPayload: {
        flowId: FLOW_ID,
        executionId: execution.id,
        stepId: nextStep.id,
      },
    })
    expect(mocks.enqueueActionJob).toHaveBeenCalledTimes(2)
  })

  it('does not clear success if a retried worker fails to enqueue', async () => {
    const { mrfStep, nextStep, execution, executionStep } =
      await seedPendingHandoff()
    await executionStep.$query().patch({ status: 'success' })
    mocks.enqueueActionJob.mockRejectedValueOnce(new Error('redis down'))

    await expect(
      claimSubTriggerAndEnqueueNext({
        executionId: execution.id,
        stepId: mrfStep.id,
        nextStep,
        jobName: `${execution.id}-${mrfStep.id}`,
        jobPayload: {
          flowId: FLOW_ID,
          executionId: execution.id,
          stepId: nextStep.id,
        },
      }),
    ).rejects.toThrow('redis down')

    const row = await ExecutionStep.query().findById(executionStep.id)
    expect(row?.status).toBe('success')
  })

  it('ignores a duplicate job id from a second enqueue', async () => {
    const { mrfStep, nextStep, execution, executionStep } =
      await seedPendingHandoff()
    await executionStep.$query().patch({ status: 'success' })
    mocks.enqueueActionJob.mockRejectedValueOnce(
      new Error('Job already exists'),
    )

    await claimSubTriggerAndEnqueueNext({
      executionId: execution.id,
      stepId: mrfStep.id,
      nextStep,
      jobName: `${execution.id}-${mrfStep.id}`,
      jobPayload: {
        flowId: FLOW_ID,
        executionId: execution.id,
        stepId: nextStep.id,
      },
    })

    const row = await ExecutionStep.query().findById(executionStep.id)
    expect(row?.status).toBe('success')
  })

  it('enqueues only once when two claims race', async () => {
    const { mrfStep, nextStep, execution } = await seedPendingHandoff()
    const params = {
      executionId: execution.id,
      stepId: mrfStep.id,
      nextStep,
      jobName: `${execution.id}-${mrfStep.id}`,
      jobPayload: {
        flowId: FLOW_ID,
        executionId: execution.id,
        stepId: nextStep.id,
      },
    }

    await Promise.all([
      claimSubTriggerAndEnqueueNext(params),
      claimSubTriggerAndEnqueueNext(params),
    ])

    expect(mocks.enqueueActionJob).toHaveBeenCalledTimes(2)
    const row = await ExecutionStep.query().findOne({
      execution_id: execution.id,
      step_id: mrfStep.id,
    })
    expect(row?.status).toBe('success')
  })
})
