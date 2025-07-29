import paginate from '@/helpers/pagination'
import Execution from '@/models/execution'
import type ExtendedQueryBuilder from '@/models/query-builder'

import type { QueryResolvers } from '../__generated__/types.generated'

const getExecutions: QueryResolvers['getExecutions'] = async (
  _parent,
  params,
  context,
) => {
  const filterBuilder = (builder: ExtendedQueryBuilder<Execution>) => {
    builder.where('test_run', 'FALSE')
    builder.where('flow_id', params.flowId)

    if (!('status' in params)) {
      builder.whereNull('status')
    }
    if (params.status) {
      builder.where('status', params.status)
    }
  }

  const executionsQuery = context.currentUser
    .$relatedQuery('executions')
    .withGraphFetched({
      executionSteps: true,
    })
    .modifyGraph('executionSteps', (builder) => {
      builder
        .select('execution_steps.*')
        .distinctOn('execution_steps.execution_id', 'execution_steps.step_id')
        .orderBy([
          { column: 'execution_steps.execution_id' },
          { column: 'execution_steps.step_id' },
          { column: 'execution_steps.created_at', order: 'desc' },
        ])
    })
    .where(filterBuilder)
    .withSoftDeleted()
    .orderBy('created_at', 'desc')

  return paginate(executionsQuery, params.limit, params.offset)
}
export default getExecutions
