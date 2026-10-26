import type { TestRunStepMetadata } from '@plumber/types'
import { raw } from 'objection'

import type ExecutionStep from '@/models/execution-step'
import Flow from '@/models/flow'
import type Step from '@/models/step'
import {
  getMrfTestStartStep,
  isMrfStep,
  type MrfStageTestResult,
  testRemainingMrfSteps,
} from '@/services/test-mrf-steps'
import testStep from '@/services/test-step'

export interface RunStepTestInput {
  step: Step
  testRunMetadata?: TestRunStepMetadata
}

export interface RunStepTestResult {
  step: Step
  executionStep: ExecutionStep
  stageResults: MrfStageTestResult[]
}

// An MRF form is tested from its trigger, whichever stage was requested.
export async function runStepTest({
  step,
  testRunMetadata,
}: RunStepTestInput): Promise<RunStepTestResult> {
  const startStep = isMrfStep(step) ? await getMrfTestStartStep(step) : step

  const { executionStep, executionId } = await testStep({
    stepId: startStep.id,
    testRunMetadata,
  })

  await Flow.query().patchAndFetchById(startStep.flowId, {
    testExecutionId: executionId,
  })

  if (executionStep.isFailed) {
    return { step: startStep, executionStep, stageResults: [] }
  }

  const updatedStep = await startStep.$query().patchAndFetch({
    status: 'completed',
    config: raw(`config - 'templateConfig'`),
  })

  const stageResults = isMrfStep(updatedStep)
    ? await testRemainingMrfSteps(startStep.flowId, testRunMetadata)
    : []

  return { step: updatedStep, executionStep, stageResults }
}
