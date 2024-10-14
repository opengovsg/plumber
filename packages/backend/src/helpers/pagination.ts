import type { Model } from 'objection'

import ExtendedQueryBuilder from '@/models/query-builder'

const paginate = async <TModel extends Model>(
  query: ExtendedQueryBuilder<TModel, TModel[]>,
  limit: number,
  offset: number,
) => {
  if (limit < 1 || limit > 100) {
    throw new Error('Limit must be between 1 and 100')
  }

  const [records, count] = await Promise.all([
    query.limit(limit).offset(offset),
    query.resultSize(),
  ])

  return {
    pageInfo: {
      currentPage: Math.ceil(offset / limit + 1),
      totalCount: count,
    },
    edges: records.map((record: TModel) => {
      // TODO: remove this node key and return the record directly
      return {
        node: record,
      }
    }),
  }
}

export default paginate
