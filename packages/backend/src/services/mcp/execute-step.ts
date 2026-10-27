import type { IDataOutMetadata, IJSONObject } from '@plumber/types'
import { NotFoundError } from 'objection'

import logger from '@/helpers/logger'
import Step from '@/models/step'
import type User from '@/models/user'
import { loadAccessibleStep } from '@/services/access'
import { runStepTest } from '@/services/run-step-test'

import { PublishedPipeError } from './published-pipe-error'

export interface McpExecuteStepResult {
  success: boolean
  pipeId: string
  stepId: string
  executionStepId: string
  dataOut: IJSONObject | null
  dataOutMetadata: IDataOutMetadata | null
  errorDetails: IJSONObject | null
  // Set when the trigger passed but an MRF stage step failed its test.
  failedStepId: string | null
}

export async function executeStepService(
  user: User,
  stepId: string,
): Promise<McpExecuteStepResult> {
  const requestedStep = await loadAccessibleStep({
    user,
    stepId,
    role: 'editor',
    graph: 'flow',
  })

  if (!requestedStep) {
    throw new NotFoundError({ modelClass: Step })
  }

  if (requestedStep.flow.active) {
    throw new PublishedPipeError()
  }

  // Chat has no live form event to wait on, so tests prefer mock submissions.
  // Apps that do not recognise preferMock ignore it.
  const {
    step,
    executionStep: startExecutionStep,
    stageResults,
  } = await runStepTest({
    step: requestedStep,
    testRunMetadata: { preferMock: true },
  })

  let resultStep = step
  let executionStep = startExecutionStep
  const stageFailure = stageResults.find(
    (result) => result.executionStep.isFailed,
  )
  // Each stage has its own submission. Downstream variables come from this output.
  const stageResult =
    stageResults.find((result) => result.step.id === requestedStep.id) ??
    stageFailure
  if (stageResult && requestedStep.id !== step.id) {
    resultStep = stageResult.step
    executionStep = stageResult.executionStep
  }

  const command = resultStep.isAction
    ? await resultStep.getActionCommand()
    : await resultStep.getTriggerCommand()
  const dataOutMetadata: IDataOutMetadata | null = await (
    command?.getDataOutMetadata?.(executionStep) ?? Promise.resolve(null)
  ).catch((error: Error): IDataOutMetadata | null => {
    logger.warn('executeStepService: failed to get dataOut metadata', {
      stepId: resultStep.id,
      appKey: resultStep.appKey,
      key: resultStep.key,
      error: error.message,
    })
    return null
  })

  return {
    success: !executionStep.isFailed && !stageFailure,
    pipeId: resultStep.flowId,
    stepId: resultStep.id,
    executionStepId: executionStep.id,
    dataOut: executionStep.dataOut ?? null,
    dataOutMetadata,
    errorDetails:
      (stageFailure?.executionStep ?? executionStep).errorDetails ?? null,
    failedStepId: stageFailure?.step.id ?? null,
  }
}
