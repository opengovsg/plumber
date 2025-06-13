import { raw } from 'objection'

import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
} from '@/apps/toolbox/common/constants'
import paginate from '@/helpers/pagination'
import ExecutionStep from '@/models/execution-step'

import type { QueryResolvers } from '../__generated__/types.generated'

const getExecutionSteps: QueryResolvers['getExecutionSteps'] = async (
  _parent,
  params,
  context,
) => {
  const execution = await context.currentUser
    .$relatedQuery('executions')
    .withSoftDeleted()
    .findById(params.executionId)
    .throwIfNotFound()

  // get most recent execution step for each step
  const executionSteps = execution
    .$relatedQuery('executionSteps')
    .with('latest_steps', (builder) => {
      builder
        .select(
          'step_id',
          raw('max(created_at) as max_created_at'),
          raw('min(created_at) as min_created_at'),
        )
        .from('execution_steps')
        .groupBy('step_id')
        .where('execution_id', '=', execution.id)
        .withSoftDeleted()
    })
    .join('latest_steps', (builder) => {
      builder
        .on('execution_steps.step_id', '=', 'latest_steps.step_id')
        .andOn('execution_steps.created_at', '=', 'latest_steps.max_created_at')
    })
    .select('execution_steps.*', 'min_created_at')
    .withSoftDeleted()
    .orderBy('min_created_at', 'asc')

  // check if the execution has a for-each step
  const hasForEach = await executionSteps
    .clone()
    .findOne({
      app_key: TOOLBOX_APP_KEY,
      key: TOOLBOX_ACTIONS.FOR_EACH,
    })
    .then((result) => !!result)

  // NOTE: use a separate query for for-each
  // as there are multiple execution steps with the same step_id in the same execution
  if (hasForEach) {
    const forEachExecutionSteps = await ExecutionStep.getForEachExecutionSteps(
      execution.id,
    )

    return {
      pageInfo: {
        currentPage: 1,
        totalCount: 100,
      },
      edges: forEachExecutionSteps.map((record) => ({
        node: record,
      })),
    }
  }

  return paginate(executionSteps, params.limit, params.offset)
}

export default getExecutionSteps
