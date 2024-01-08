import paginate from '@/helpers/pagination'
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
    if (!('status' in params)) {
      builder.whereNull('status')
    }
    if (params.status) {
      builder.where('status', params.status)
    }
    if (params.searchInput) {
      builder.where('name', 'ilike', `%${params.searchInput}%`)
    }
  }

  const executionsQuery = context.currentUser
    .$relatedQuery('executions')
    .withGraphFetched({
      flow: {
        steps: true,
      },
    })
    .where(filterBuilder)
    .orderBy('created_at', 'desc')

  return paginate(executionsQuery, params.limit, params.offset)
}
export default getExecutions
