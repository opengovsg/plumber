import { raw } from 'objection'

import ExecutionStep from '@/models/execution-step'

import type { QueryResolvers } from '../__generated__/types.generated'

const getTestExecutionSteps: QueryResolvers['getTestExecutionSteps'] = async (
  _parent,
  params,
  context,
) => {
  const flow = await context.currentUser
    .$relatedQuery('flows')
    .findById(params.flowId)
    .withGraphFetched({
      testExecution: {
        executionSteps: {
          step: true,
        },
      },
      steps: true,
    })
    .throwIfNotFound()

  if (flow.testExecution) {
    return flow.testExecution.executionSteps
  }

  /**
   * If test execution id does not exist, we fetch the last execution steps for each step
   */
  const latestExecutionSteps = await ExecutionStep.query()
    .with('latest_execution_steps', (builder) => {
      builder
        .select(
          '*',
          raw(
            'ROW_NUMBER() OVER (PARTITION BY step_id ORDER BY execution_steps.created_at DESC) as rn',
          ),
        )
        .from('execution_steps')
        .whereIn(
          'step_id',
          flow.steps.map((step) => step.id),
        )
    })
    .select('*')
    .from('latest_execution_steps')
    .withGraphFetched({
      step: true,
    })
    .where('rn', '=', 1)
    .withSoftDeleted() // because this adds a 'execution_steps.deleted_at' column to the query instead of latest_execution_steps

  // sort by step position
  latestExecutionSteps.sort((a, b) => a.step.position - b.step.position)

  return latestExecutionSteps
}

export default getTestExecutionSteps
