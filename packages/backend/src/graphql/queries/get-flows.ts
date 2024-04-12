import paginate from '@/helpers/pagination'

import type { QueryResolvers } from '../__generated__/types.generated'

const getFlows: QueryResolvers['getFlows'] = async (
  _parent,
  params,
  context,
) => {
  const flowsQuery = context.currentUser
    .$relatedQuery('flows')
    .joinRelated({
      steps: true,
    })
    .withGraphFetched({
      steps: {
        connection: true,
      },
      pendingTransfer: true,
    })
    .where((builder) => {
      if (params.connectionId) {
        builder.where('steps.connection_id', params.connectionId)
      }

      if (params.name) {
        builder.where('flows.name', 'ilike', `%${params.name}%`)
      }

      if (params.appKey) {
        builder.where('steps.app_key', params.appKey)
      }
    })
    .groupBy('flows.id')
    .orderBy('active', 'desc')
    .orderBy('updated_at', 'desc')

  return paginate(flowsQuery, params.limit, params.offset)
}

export default getFlows
