import type { IDataOutMetadata, IJSONObject } from '@plumber/types'
import { raw } from 'objection'

import logger from '@/helpers/logger'
import Flow from '@/models/flow'
import type User from '@/models/user'
import testStep from '@/services/test-step'

export interface McpExecuteStepResult {
  success: boolean
  pipeId: string
  stepId: string
  executionStepId: string
  dataOut: IJSONObject | null
  dataOutMetadata: IDataOutMetadata | null
  errorDetails: IJSONObject | null
}

export async function executeStepService(
  user: User,
  stepId: string,
): Promise<McpExecuteStepResult> {
  const step = await user
    .withAccessibleSteps({ requiredRole: 'editor' })
    .withGraphFetched('flow')
    .findById(stepId)
    .throwIfNotFound()

  if (step.flow.active) {
    throw new Error('Cannot test a step in an active pipe')
  }

  // TODO: MRF redirect when AI builder supports it

  // AI Builder testing happens inline in chat, with no real user action to
  // wait on — always prefer mock data (e.g. FormSG's newSubmission trigger)
  // instead of waiting on a real event. Apps that don't recognise
  // `preferMock` in their testRunMetadata schema just ignore it.
  const { executionStep, executionId } = await testStep({
    stepId: step.id,
    testRunMetadata: { preferMock: true },
  })

  await Flow.query().patchAndFetchById(step.flowId, {
    testExecutionId: executionId,
  })

  if (!executionStep.isFailed) {
    await step.$query().patchAndFetch({
      status: 'completed',
      config: raw(`config - 'templateConfig'`),
    })
  }

  const command = step.isAction
    ? await step.getActionCommand()
    : await step.getTriggerCommand()
  const dataOutMetadata: IDataOutMetadata | null = await (
    command?.getDataOutMetadata?.(executionStep) ?? Promise.resolve(null)
  ).catch((error: Error): IDataOutMetadata | null => {
    logger.warn('executeStepService: failed to get dataOut metadata', {
      stepId: step.id,
      appKey: step.appKey,
      key: step.key,
      error: error.message,
    })
    return null
  })

  return {
    success: !executionStep.isFailed,
    pipeId: step.flowId,
    stepId: step.id,
    executionStepId: executionStep.id,
    dataOut: executionStep.dataOut ?? null,
    dataOutMetadata,
    errorDetails: executionStep.errorDetails ?? null,
  }
}
