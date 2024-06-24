import { raw } from 'objection'

import paginate from '@/helpers/pagination'

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
    })
    .join('latest_steps', (builder) => {
      builder
        .on('execution_steps.step_id', '=', 'latest_steps.step_id')
        .andOn('execution_steps.created_at', '=', 'latest_steps.max_created_at')
    })
    .select('execution_steps.*', 'min_created_at')
    .withSoftDeleted()
    .orderBy('min_created_at', 'asc')

  return paginate(executionSteps, params.limit, params.offset)
}

export default getExecutionSteps
