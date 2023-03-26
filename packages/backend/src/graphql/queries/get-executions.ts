import { ref } from 'objection'

import paginate from '../../helpers/pagination'
import ExecutionStep from '../../models/execution-step'
import Context from '../../types/express/context'

type Params = {
  limit: number
  offset: number
}

const getExecutions = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  const executions = context.currentUser
    .$relatedQuery('executions')
    .joinRelated('executionSteps', {
      alias: 'es',
    })
    .select('executions.*', 'es.status')
    // get status from the most recent execution step
    .where(
      'es.created_at',
      '=',
      ExecutionStep.query()
        .max('created_at')
        .where('execution_id', '=', ref('executions.id')),
    )
    .withSoftDeleted()
    .withGraphFetched({
      flow: {
        steps: true,
      },
    })
    .orderBy('created_at', 'desc')

  return paginate(executions, params.limit, params.offset)
}
export default getExecutions
