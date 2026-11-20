import { raw } from 'objection'

import { BadUserInputError } from '@/errors/graphql-errors'
import Flow from '@/models/flow'
import {
  getMrfTestStartStep,
  isMrfStep,
  testRemainingMrfSteps,
} from '@/services/test-mrf-steps'
import testStep from '@/services/test-step'

import type { MutationResolvers } from '../__generated__/types.generated'

const executeStep: NonNullable<MutationResolvers['executeStep']> = async (
  _parent,
  params,
  context,
) => {
  const { input } = params
  if (!input) {
    throw new BadUserInputError('Missing input')
  }
  const { stepId } = input
  const testRunMetadata = input.testRunMetadata ?? undefined

  // Just checking for permissions here
  let stepToTest = await context.currentUser
    .withAccessibleSteps({ requiredRole: 'editor' })
    .withGraphFetched('flow')
    .findById(stepId)
    .throwIfNotFound()

  /**
   * If it is an MRF step, we need to test all steps starting from the trigger step
   * regardless of whether the trigger or action is being checked
   */
  if (isMrfStep(stepToTest)) {
    stepToTest = await getMrfTestStartStep(stepToTest)
  }

  const { executionStep, executionId } = await testStep({
    stepId: stepToTest.id,
    testRunMetadata,
    loggedInUser: context.currentUser,
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
  await testRemainingMrfSteps(
    stepToTest.flowId,
    testRunMetadata,
    context.currentUser,
  )

  return executionStep
}

export default executeStep
