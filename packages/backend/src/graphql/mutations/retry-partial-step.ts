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
    })
  } catch (e) {
    throw new Error('Failed to retry partial step')
  }

  return true
}

export default retryPartialStep
