import { DateTime } from 'luxon'

import appConfig from '@/config/app'
import paginate from '@/helpers/pagination'
import Execution from '@/models/execution'
import Flow from '@/models/flow'
import type ExtendedQueryBuilder from '@/models/query-builder'

import type { QueryResolvers } from '../__generated__/types.generated'

// Default execution history window shown on the (non-admin) frontend. Flows
// that have opted out of archival (flow.config.archiveDisabled) keep every
// execution in Postgres indefinitely, so we show all of them in that case
// rather than hiding data the archival job will never remove.
const EXECUTION_HISTORY_WINDOW = { months: 3 }

const getExecutions: QueryResolvers['getExecutions'] = async (
  _parent,
  params,
  context,
) => {
  const filterBuilder = (builder: ExtendedQueryBuilder<Execution>) => {
    builder.where('test_run', false)
    builder.where('executions.flow_id', params.flowId)

    // null status means waiting
    if (params.status === null) {
      builder.whereNull('status')
    } else if (params?.status) {
      builder.where('status', params.status)
    }
  }

  const executionsQuery = context.currentUser
    .withAccessibleExecutions({ requiredRole: 'viewer' })
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

  if (appConfig.archiveEnabled && !context.isAdminOperation) {
    const flow = await Flow.query().findById(params.flowId).select('config')

    if (!flow?.config?.archiveDisabled) {
      executionsQuery.where(
        'executions.created_at',
        '>=',
        DateTime.now().minus(EXECUTION_HISTORY_WINDOW).toISO(),
      )
    }
  }

  return paginate(executionsQuery, params.limit, params.offset)
}
export default getExecutions
