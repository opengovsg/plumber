import { raw } from 'objection'

import ExecutionStep from '@/models/execution-step'
import Flow from '@/models/flow'

export interface GetTestExecutionStepsOptions {
  stepIds?: string[]
  testExecutionId: string | null
}

async function fetchTestExecutionStepsByExecutionId(
  testExecutionId: string,
): Promise<ExecutionStep[]> {
  const testExecutionSteps = await ExecutionStep.query()
    .where('execution_id', testExecutionId)
    .withGraphFetched({
      step: true,
    })
  /**
   * NOTE: filters out test execution steps for steps that have been deleted
   * or are not yet completed
   */
  const filteredTestExecutionSteps = testExecutionSteps
    .filter((e) => e.step?.status === 'completed')
    .sort((a, b) => a.step.position - b.step.position)

  /**
   * Sanity check to ensure not more than 1 execution step per step is returned
   * If more than 1 exists, we return the latest one sorted by createdAt
   */
  const stepIds = new Set<string>()
  const dedupedTestExecutionSteps = filteredTestExecutionSteps.reduce(
    (acc, curr) => {
      if (stepIds.has(curr.stepId)) {
        const otherExecutionStep = acc[acc.length - 1]
        // possible bug in single step testing !! this should not happen
        console.warn(
          `Bug: More than 1 execution step found for step ${curr.stepId}`,
        )
        if (curr.createdAt > otherExecutionStep.createdAt) {
          acc[acc.length - 1] = curr
        }
      } else {
        stepIds.add(curr.stepId)
        acc.push(curr)
      }
      return acc
    },
    [] as ExecutionStep[],
  )

  return dedupedTestExecutionSteps
}

/**
   * If test execution id does not exist, we fetch the last execution steps for 
   each step
   */
async function fetchLatestExecutionStepsByStepIds(
  stepIds: string[],
): Promise<ExecutionStep[]> {
  const latestExecutionSteps = await ExecutionStep.query()
    .with('latest_execution_steps', (builder) => {
      builder
        .select(
          'execution_steps.*',
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
        .whereIn('step_id', stepIds)
        .andWhere('executions.test_run', true) // we only look at test runs
    })
    .select('*')
    .from('latest_execution_steps')
    .withGraphFetched({
      step: true,
    })
    .where('rn', '=', 1)
    .withSoftDeleted() // because this adds a 'execution_steps.deleted_at' column to the query instead of latest_execution_steps

  // filter by completed status and sort by step position
  const filteredSteps = latestExecutionSteps.filter(
    (e) => e.step?.status === 'completed',
  )
  filteredSteps.sort((a, b) => a.step.position - b.step.position)
  return filteredSteps
}

export async function getTestExecutionSteps(
  flowId: string,
  options?: GetTestExecutionStepsOptions,
): Promise<ExecutionStep[]> {
  // If testExecutionId is provided via options, use it directly
  if (options?.testExecutionId) {
    return fetchTestExecutionStepsByExecutionId(options.testExecutionId)
  }

  // If options provided with stepIds but no testExecutionId (backwards compat)
  if (options?.stepIds?.length) {
    return fetchLatestExecutionStepsByStepIds(options.stepIds)
  }

  // No options or incomplete options - fetch flow to determine path
  const flow = await Flow.query().findById(flowId).throwIfNotFound()
  const testExecutionId = flow.testExecutionId ?? null

  if (testExecutionId) {
    return fetchTestExecutionStepsByExecutionId(testExecutionId)
  }

  // Backwards compatibility: fetch steps for flows without testExecutionId
  const flowWithSteps = await flow
    .$query()
    .withGraphFetched('steps')
    .throwIfNotFound()

  const stepIds = flowWithSteps.steps.map((step) => step.id)
  if (!stepIds.length) {
    return []
  }

  return fetchLatestExecutionStepsByStepIds(stepIds)
}
