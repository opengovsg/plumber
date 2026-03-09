import { raw } from 'objection'

import Flow from '@/models/flow'
import Step from '@/models/step'
import testStep from '@/services/test-step'

import type { MutationResolvers } from '../__generated__/types.generated'

const executeStep: MutationResolvers['executeStep'] = async (
  _parent,
  params,
  context,
) => {
  const { stepId, testRunMetadata } = params.input

  // Just checking for permissions here
  let stepToTest = await context.currentUser
    .withAccessibleSteps({ requiredRole: 'editor' })
    .withGraphFetched('flow')
    .findById(stepId)
    .throwIfNotFound()

  const isMrf = stepToTest.appKey === 'formsg' && stepToTest.parameters.mrf

  /**
   * If it is an MRF step, we need to test all steps starting from the trigger step
   * regardless of whether the trigger or action is being checked
   */
  if (isMrf) {
    const mrfSteps = await Step.query()
      .where('app_key', 'formsg')
      .andWhere('flow_id', stepToTest.flowId)
      .orderBy('position', 'asc')
      .limit(1)

    if (mrfSteps.length === 1) {
      stepToTest = mrfSteps[0]
    }
  }

  const { executionStep, executionId } = await testStep({
    stepId: stepToTest.id,
    testRunMetadata,
  })

  await Flow.query().patchAndFetchById(stepToTest.flowId, {
    testExecutionId: executionId,
  })

  let shouldContinueTestingMrfSteps = false

  if (!executionStep.isFailed) {
    const updatedStep = await stepToTest.$query().patchAndFetch({
      // Update step status
      status: 'completed',
      // clear templateConfig in config when step is tested successfully
      config: raw(`config - 'templateConfig'`),
    })

    // we check if the step is an MRF step again after testing
    shouldContinueTestingMrfSteps = !!updatedStep.parameters.mrf
  } else {
    return executionStep
  }

  if (!shouldContinueTestingMrfSteps) {
    return executionStep
  }

  /**
   * Test remaining steps in the mrf flow
   */
  const remainingSteps = await Step.query()
    .where('app_key', 'formsg')
    .andWhere('flow_id', stepToTest.flowId)
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

  return executionStep
}

export default executeStep
