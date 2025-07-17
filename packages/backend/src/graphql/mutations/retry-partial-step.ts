import { ref } from 'objection'

import { BadUserInputError } from '@/errors/graphql-errors'
import ExecutionStep from '@/models/execution-step'
import { processAction } from '@/services/action'

import type { MutationResolvers } from '../__generated__/types.generated'

const retryPartialStep: MutationResolvers['retryPartialStep'] = async (
  _parent,
  params,
  context,
) => {
  const executionStep = await ExecutionStep.query()
    .findById(params.input.executionStepId)
    .withGraphJoined('execution')
    .whereExists(
      context.currentUser
        .$relatedQuery('executions')
        .select(1)
        .where('executions.id', ref('execution_steps.execution_id')),
    )

  if (!executionStep) {
    throw new BadUserInputError('Execution step not found')
  }

  if (executionStep.status !== 'success' || !executionStep.errorDetails) {
    throw new BadUserInputError('Execution step not partially retriable')
  }

  try {
    await processAction({
      executionId: executionStep.executionId,
      flowId: executionStep.execution.flowId,
      stepId: executionStep.stepId,
      metadata: executionStep.metadata,
    })

    /**
     * FOR-EACH SPECIAL CASE:
     * Partial retry means that subsequent steps were allowed to proceed in the initial execution.
     * We need to manually handle the iteration status here as the nextStep would not continue to run
     * if the subsequent steps have already run and succeeded.
     */
    if (executionStep.metadata?.iteration) {
      const iterationSteps = await ExecutionStep.getIterationSteps(
        executionStep.executionId,
        executionStep.metadata.iteration,
      )

      const isIterationSuccessful = iterationSteps.every(
        (step) => step.status === 'success' && step.errorDetails === null,
      )

      if (isIterationSuccessful) {
        await ExecutionStep.patchIterationStatus(
          executionStep.executionId,
          executionStep.metadata.iteration,
          'success',
        )
      }
    }
  } catch (e) {
    throw new Error('Failed to retry partial step')
  }

  return true
}

export default retryPartialStep
