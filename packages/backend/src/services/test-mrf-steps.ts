import type { TestRunStepMetadata } from '@plumber/types'

import { raw } from 'objection'

import Step from '@/models/step'
import testStep from '@/services/test-step'

// Moved as-is from the editor's executeStep mutation, so the AI Builder tests
// an MRF form exactly as the editor does.

export function isMrfStep(step: Pick<Step, 'appKey' | 'parameters'>): boolean {
  return !!(step.appKey === 'formsg' && step.parameters.mrf)
}

/**
 * If it is an MRF step, we need to test all steps starting from the trigger step
 * regardless of whether the trigger or action is being checked
 */
export async function getMrfTestStartStep(stepToTest: Step): Promise<Step> {
  const mrfSteps = await Step.query()
    .where('app_key', 'formsg')
    .andWhere('flow_id', stepToTest.flowId)
    .orderBy('position', 'asc')
    .limit(1)

  if (mrfSteps.length === 1) {
    stepToTest = mrfSteps[0]
  }

  return stepToTest
}

/**
 * Test remaining steps in the mrf flow
 */
export async function testRemainingMrfSteps(
  flowId: string,
  testRunMetadata?: TestRunStepMetadata,
): Promise<void> {
  const remainingSteps = await Step.query()
    .where('app_key', 'formsg')
    .andWhere('flow_id', flowId)
    .andWhere('type', 'action')
    .orderBy('position', 'asc')

  for (const remainingStep of remainingSteps) {
    const { executionStep } = await testStep({
      stepId: remainingStep.id,
      testRunMetadata,
    })

    if (!executionStep.isFailed) {
      await remainingStep.$query().patch({
        // Update step status
        status: 'completed',
        // clear templateConfig in config when step is tested successfully
        config: raw(`config - 'templateConfig'`),
      })
    } else {
      break
    }
  }
}
