import type { IJSONObject } from '@plumber/types'

import { raw } from 'objection'

import Flow from '@/models/flow'
import type User from '@/models/user'
import testStep from '@/services/test-step'

export interface McpExecuteStepResult {
  success: boolean
  pipeId: string
  stepId: string
  executionStepId: string
  dataOut: IJSONObject | null
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

  const { executionStep, executionId } = await testStep({ stepId: step.id })

  await Flow.query().patchAndFetchById(step.flowId, {
    testExecutionId: executionId,
  })

  if (!executionStep.isFailed) {
    await step.$query().patchAndFetch({
      status: 'completed',
      config: raw(`config - 'templateConfig'`),
    })
  }

  return {
    success: !executionStep.isFailed,
    pipeId: step.flowId,
    stepId: step.id,
    executionStepId: executionStep.id,
    dataOut: executionStep.dataOut ?? null,
    errorDetails: executionStep.errorDetails ?? null,
  }
}
