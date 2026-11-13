/**
 * Business rules:
 * - "retry a successful job without running the rest of the pipe".
 * - "blocks on triggers, toolbox (only continue if, for-each and if then), and
 *   delay - because it doesn't make sense to retry these on success".
 */
import { randomUUID } from 'crypto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
} from '@/apps/toolbox/common/constants'
import retryExecutionStep from '@/graphql/mutations/retry-execution-step'
import * as launchDarkly from '@/helpers/launch-darkly'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Flow from '@/models/flow'
import Step from '@/models/step'
import * as actionQueue from '@/queues/action'
import Context from '@/types/express/context'

import { generateMockContext } from './tiles/table.mock'

describe('retryExecutionStep on a successful execution step', () => {
  let context: Context
  let flow: Flow
  let execution: Execution
  let enqueueActionJobSpy: ReturnType<typeof vi.spyOn>

  async function insertSuccessfulExecutionStep(
    step: Pick<Step, 'appKey' | 'key' | 'type'>,
  ): Promise<ExecutionStep> {
    const insertedStep = await Step.query().insert({
      id: randomUUID(),
      flowId: flow.id,
      position: 2,
      parameters: {},
      status: 'completed',
      ...step,
    })
    return ExecutionStep.query().insertAndFetch({
      executionId: execution.id,
      stepId: insertedStep.id,
      status: 'success',
      appKey: step.appKey,
      key: step.key,
      jobId: 'completed-job-id',
      dataOut: {},
      metadata: {},
    })
  }

  beforeEach(async () => {
    vi.spyOn(launchDarkly, 'getLdFlagValue').mockResolvedValue(true)
    enqueueActionJobSpy = vi
      .spyOn(actionQueue, 'enqueueActionJob')
      .mockResolvedValue(undefined as never)

    context = await generateMockContext()
    flow = await Flow.query().insert({
      id: randomUUID(),
      name: 'Test Flow',
      userId: context.currentUser.id,
      active: false,
    })
    execution = await Execution.query().insert({
      id: randomUUID(),
      flowId: flow.id,
      testRun: false,
      internalId: 'test-execution-1',
      status: 'success',
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('enqueues only this step', async () => {
    const executionStep = await insertSuccessfulExecutionStep({
      appKey: 'postman',
      key: 'sendTransactionalEmail',
      type: 'action',
    })

    await retryExecutionStep(
      null,
      { input: { executionStepId: executionStep.id } },
      context,
    )

    expect(enqueueActionJobSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        jobData: expect.objectContaining({
          stepId: executionStep.stepId,
          runOnlyThisStep: true,
        }),
      }),
    )
  })

  it.each([
    { appKey: 'formsg', key: 'newSubmission', type: 'trigger' as const },
    {
      appKey: TOOLBOX_APP_KEY,
      key: TOOLBOX_ACTIONS.ONLY_CONTINUE_IF,
      type: 'action' as const,
    },
    {
      appKey: TOOLBOX_APP_KEY,
      key: TOOLBOX_ACTIONS.FOR_EACH,
      type: 'action' as const,
    },
    {
      appKey: TOOLBOX_APP_KEY,
      key: TOOLBOX_ACTIONS.IF_THEN,
      type: 'action' as const,
    },
    { appKey: 'delay', key: 'delayFor', type: 'action' as const },
    { appKey: 'delay', key: 'delayUntil', type: 'action' as const },
  ])('rejects $appKey $key', async (step) => {
    const executionStep = await insertSuccessfulExecutionStep(step)

    await expect(
      retryExecutionStep(
        null,
        { input: { executionStepId: executionStep.id } },
        context,
      ),
    ).rejects.toThrow('This step cannot be retried after it succeeds')
    expect(enqueueActionJobSpy).not.toHaveBeenCalled()
  })
})
