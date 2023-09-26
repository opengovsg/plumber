// import { raw } from 'objection'

import Execution from '@/models/execution'
import ExtendedQueryBuilder from '@/models/query-builder'
import Context from '@/types/express/context'

type Params = {
  limit: number
  offset: number
  status?: string
  searchInput?: string
}

const getExecutions = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  const filterBuilder = (builder: ExtendedQueryBuilder<Execution>) => {
    builder.where('test_run', 'FALSE')
    if (params.status) {
      builder.where('status', params.status)
    }
    if (params.searchInput) {
      builder.where('name', 'ilike', `${params.searchInput}%`)
    }
  }

  const results = context.currentUser
    .$relatedQuery('executions')
    .withGraphFetched({
      flow: {
        steps: true,
      },
    })
    .where(filterBuilder)
    .limit(params.limit)
    .offset(params.offset)
    .orderBy('created_at', 'desc')
    .debug()

  // remove when only confirmed data is backfilled
  // disgustingly long query to fetch latest execution step for each execution to get status
  // would rather use raw query but wdv
  // const results = context.currentUser
  //   .$relatedQuery('executions')
  //   .with('user_flows', (builder) => {
  //     builder
  //       .select('id')
  //       .from('flows')
  //       .where('user_id', context.currentUser.id)
  //       .withSoftDeleted()
  //   })
  //   .with('user_executions', (builder) => {
  //     builder
  //       .select('id')
  //       .from('executions')
  //       .whereIn('flow_id', (builder) =>
  //         builder.select('id').from('user_flows').withSoftDeleted(),
  //       )
  //       .withSoftDeleted()
  //       .orderBy('created_at', 'desc')
  //       .where('deleted_at', null)
  //       .where('test_run', 'FALSE')
  //   })
  //   .with('user_execution_steps', (builder) => {
  //     builder
  //       .select('*')
  //       .from('execution_steps')
  //       .whereIn('execution_id', (builder) => {
  //         builder.select('id').from('user_executions').withSoftDeleted()
  //       })
  //       .withSoftDeleted()
  //   })
  //   .with('execution_steps_created_at', (builder) => {
  //     builder
  //       .select('execution_id', raw('max(created_at) as max_created_at'))
  //       .from('user_execution_steps')
  //       .groupBy('execution_id')
  //       .withSoftDeleted()
  //   })
  //   .with('latest_execution_steps', (builder) => {
  //     builder
  //       .select(
  //         'user_execution_steps.execution_id',
  //         'user_execution_steps.status',
  //       )
  //       .from('user_execution_steps')
  //       .join('execution_steps_created_at', (builder) => {
  //         builder
  //           .on(
  //             'user_execution_steps.execution_id',
  //             '=',
  //             'execution_steps_created_at.execution_id',
  //           )
  //           .andOn(
  //             'user_execution_steps.created_at',
  //             '=',
  //             'execution_steps_created_at.max_created_at',
  //           )
  //       })
  //       .withSoftDeleted()
  //   })
  //   .select('executions.*', 'latest_execution_steps.status')
  //   .withGraphFetched({
  //     flow: {
  //       steps: true,
  //     },
  //   })
  //   .join('latest_execution_steps', (builder) => {
  //     builder.on('executions.id', '=', 'latest_execution_steps.execution_id')
  //   })
  //   .orderBy('created_at', 'desc')

  const resultSize = context.currentUser
    .$relatedQuery('executions')
    .where(filterBuilder)
    .resultSize()

  const [records, count] = await Promise.all([results, resultSize])

  return {
    pageInfo: {
      currentPage: Math.ceil(params.offset / params.limit + 1),
      totalPages: Math.ceil(count / params.limit),
    },
    edges: records.map((record: Execution) => {
      return {
        node: record,
      }
    }),
  }
}
export default getExecutions
