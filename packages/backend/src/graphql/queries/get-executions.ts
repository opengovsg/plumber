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
