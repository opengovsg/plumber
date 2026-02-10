import { raw } from 'objection'

import ExecutionStep from '@/models/execution-step'
import Flow from '@/models/flow'

export interface GetTestExecutionStepsOptions {
  stepIds: string[]
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
   */
  const filteredTestExecutionSteps = testExecutionSteps
    .filter((e) => e.step)
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

  // sort by step position
  latestExecutionSteps.sort((a, b) => a.step.position - b.step.position)
  return latestExecutionSteps
}

export async function getTestExecutionSteps(
  flowId: string,
  options?: GetTestExecutionStepsOptions,
): Promise<ExecutionStep[]> {
  let stepIds: string[]
  let testExecutionId: string | null

  // The reason why we may need to fetch the flow step IDs again is because this function is being used in other parts of the codebase e.g. test-step.ts and get-case-fields.ts where it does not have access to the entire flow object
  if (options) {
    stepIds = options.stepIds
    testExecutionId = options.testExecutionId
  } else {
    const flow = await Flow.query()
      .findById(flowId)
      .withGraphFetched('steps')
      .throwIfNotFound()

    stepIds = flow.steps.map((step) => step.id)
    testExecutionId = flow.testExecutionId ?? null
  }

  // Sanity check to ensure step ids are provided
  if (!stepIds.length) {
    console.warn(
      'No step ids obtained, returning empty array of execution steps',
    )
    return []
  }

  if (testExecutionId) {
    return fetchTestExecutionStepsByExecutionId(testExecutionId)
  }

  // This is for backwards compatibility for flows without test execution id
  return fetchLatestExecutionStepsByStepIds(stepIds)
}
