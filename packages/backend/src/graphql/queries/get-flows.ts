import paginate from '@/helpers/pagination'
import Flow from '@/models/flow'

import type { QueryResolvers } from '../__generated__/types.generated'

const getFlows: QueryResolvers['getFlows'] = async (
  _parent,
  params,
  context,
) => {
  const filteredFlowIds = (
    await context.currentUser
      .$relatedQuery('flows')
      .distinct('id')
      .where((builder) => {
        if (params.name) {
          builder.where('name', 'ilike', `%${params.name}%`)
        }
      })
  ).map((f) => f.id)

  if (!filteredFlowIds.length) {
    return {
      pageInfo: {
        currentPage: 1,
        totalCount: 0,
      },
      edges: [],
    }
  }

  const flowsQuery = Flow.query()
    .with('filtered_steps', (builder) => {
      builder
        .distinct('flow_id')
        .from('steps')
        .where((stepBuilder) => {
          if (params.connectionId) {
            stepBuilder.where('connection_id', params.connectionId)
          }

          if (params.appKey) {
            stepBuilder.where('app_key', params.appKey)
          }

          stepBuilder.withSoftDeleted()
        })
        .whereNull('deleted_at')
        .whereIn('flow_id', filteredFlowIds)
        .withSoftDeleted()
    })
    .innerJoin('filtered_steps', 'id', 'filtered_steps.flow_id')
    .withGraphFetched({
      steps: {
        connection: true,
      },
      pendingTransfer: true,
    })
    .groupBy('id')
    .orderBy('active', 'desc')
    .orderBy('updated_at', 'desc')

  return paginate(flowsQuery, params.limit, params.offset)
}

export default getFlows
