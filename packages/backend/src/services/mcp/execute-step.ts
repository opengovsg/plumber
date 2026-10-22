import type { IDataOutMetadata, IJSONObject } from '@plumber/types'

import { raw } from 'objection'

import logger from '@/helpers/logger'
import Flow from '@/models/flow'
import type User from '@/models/user'
import {
  getMrfTestStartStep,
  isMrfStep,
  type MrfStageTestResult,
  testRemainingMrfSteps,
} from '@/services/test-mrf-steps'
import testStep from '@/services/test-step'

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
  const requestedStep = await user
    .withAccessibleSteps({ requiredRole: 'editor' })
    .withGraphFetched('flow')
    .findById(stepId)
    .throwIfNotFound()

  if (requestedStep.flow.active) {
    throw new PublishedPipeError()
  }

  // Same as the editor: an MRF form is tested as a whole, from its trigger.
  const step = isMrfStep(requestedStep)
    ? await getMrfTestStartStep(requestedStep)
    : requestedStep

  // AI Builder testing happens inline in chat, with no real user action to
  // wait on — always prefer mock data (e.g. FormSG's newSubmission trigger)
  // instead of waiting on a real event. Apps that don't recognise
  // `preferMock` in their testRunMetadata schema just ignore it.
  const { executionStep: startExecutionStep, executionId } = await testStep({
    stepId: step.id,
    testRunMetadata: { preferMock: true },
  })

  await Flow.query().patchAndFetchById(step.flowId, {
    testExecutionId: executionId,
  })

  let resultStep = step
  let executionStep = startExecutionStep
  let stageFailure: MrfStageTestResult | undefined
  if (!startExecutionStep.isFailed) {
    const completedStep = await step.$query().patchAndFetch({
      status: 'completed',
      config: raw(`config - 'templateConfig'`),
    })

    // Passing the trigger completes every stage step too, as in the editor.
    if (isMrfStep(completedStep)) {
      const stageResults = await testRemainingMrfSteps(step.flowId, {
        preferMock: true,
      })
      // Each stage has its own submission and field set. The model wires
      // downstream variables from this output.
      stageFailure = stageResults.find(
        (result) => result.executionStep.isFailed,
      )
      const stageResult =
        stageResults.find((result) => result.step.id === requestedStep.id) ??
        stageFailure
      if (stageResult && requestedStep.id !== step.id) {
        resultStep = stageResult.step
        executionStep = stageResult.executionStep
      }
    }
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
