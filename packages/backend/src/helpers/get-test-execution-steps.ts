import { raw } from 'objection'

import ExecutionStep from '@/models/execution-step'
import Flow from '@/models/flow'

export async function getTestExecutionSteps(
  flowId: string,
): Promise<ExecutionStep[]> {
  const flow = await Flow.query()
    .findById(flowId)
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
        // this join might seem expensive but the query planner is smart enough to optimize it
        // see notion doc (Single Step Testing) on EXPLAIN ANALYZE results
        .innerJoin(
          'executions',
          'execution_steps.execution_id',
          'executions.id',
        )
        .whereIn(
          'step_id',
          flow.steps.map((step) => step.id),
        )
        // We only look at test runs
        .andWhere('executions.test_run', true)
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
