import paginate from '@/helpers/pagination'

import type { QueryResolvers } from '../__generated__/types.generated'

const getFlows: QueryResolvers['getFlows'] = async (
  _parent,
  params,
  context,
) => {
  // Get the base query with role selection and accessibility filtering
  const baseQuery = context.currentUser.withAccessible({
    type: 'flow',
    requiredRole: 'viewer',
  })

  // Apply additional filters to the base query
  const filteredFlowIds = (
    await baseQuery
      .clone()
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

  const flowsQuery = baseQuery
    .clone()
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
    .innerJoin('filtered_steps', 'flows.id', 'filtered_steps.flow_id')
    .whereIn('flows.id', filteredFlowIds)

  flowsQuery
    .withGraphFetched({
      steps: {
        connection: true,
      },
      pendingTransfer: true,
      collaborators: {
        user: true,
      },
    })
    .groupBy('flows.id')
    .orderBy('active', 'desc')
    .orderBy('updated_at', 'desc')

  return paginate(flowsQuery, params.limit, params.offset)
}

export default getFlows
